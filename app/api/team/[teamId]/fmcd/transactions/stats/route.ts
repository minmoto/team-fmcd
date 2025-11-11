import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { FMCDTransaction, FMCDTransactionType, FMCDTransactionStatus } from "@/lib/types/fmcd";
import { getTeamConfig } from "@/lib/storage/team-storage";
import { fmcdRequest, ensureNumber } from "@/lib/fmcd/utils";
import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  subWeeks,
  subMonths,
  endOfDay,
  isAfter,
  isBefore,
} from "date-fns";

interface TransactionStats {
  period: string;
  totalTransactions: number;
  totalVolumeMsats: number;
  lightningReceive: number;
  lightningSend: number;
  onchainReceive: number;
  onchainSend: number;
  ecashMint: number;
  ecashSpend: number;
  completedTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
}

interface StatsResponse {
  federationId: string;
  federationName?: string;
  timeframe: "day" | "week" | "month";
  stats: TransactionStats[];
  summary: {
    totalTransactions: number;
    totalVolumeMsats: number;
    avgVolumePerPeriod: number;
    mostActiveType: string;
    successRate: number;
  };
}

// Helper function to extract amount from Lightning invoice
function extractAmountFromInvoice(invoice: string): number {
  try {
    const match = invoice.match(/ln(bc|tb|tbs|bcrt)(\d+)([munp]?)/);
    if (!match) return 0;

    const amount = parseInt(match[2]);
    const unit = match[3];

    switch (unit) {
      case "m":
        return amount * 100000000;
      case "u":
        return amount * 100000;
      case "n":
        return Math.floor(amount * 100);
      case "p":
        return Math.floor(amount / 10);
      default:
        return amount * 100000000000;
    }
  } catch (error) {
    return 0;
  }
}

// Helper function to fetch all transactions for a federation
async function fetchAllFederationTransactions(
  federationId: string,
  config: any
): Promise<FMCDTransaction[]> {
  try {
    const response = await fmcdRequest<any>({
      endpoint: "/v2/admin/operations",
      method: "POST",
      body: { federationId, limit: 1000 }, // Fetch up to 1000 transactions
      config,
      maxRetries: 2,
      timeoutMs: 10000,
    });

    if (response.error || !response.data) {
      console.warn(
        `Failed to fetch transactions for federation ${federationId}: ${response.error}`
      );
      return [];
    }

    const operations = response.data.operations || [];
    return operations.map((op: any) => {
      let amountMsats = 0;
      let type: FMCDTransaction["type"] = FMCDTransactionType.EcashMint;
      let status: FMCDTransaction["status"] = FMCDTransactionStatus.Pending;

      // Determine transaction type and amount
      if (op.operationKind === "ln") {
        if (op.operationMeta?.variant?.receive) {
          type = FMCDTransactionType.LightningReceive;
          const invoice = op.operationMeta.variant.receive.invoice;
          if (invoice) amountMsats = extractAmountFromInvoice(invoice);
        } else if (op.operationMeta?.variant?.pay) {
          type = FMCDTransactionType.LightningSend;
          const invoice = op.operationMeta.variant.pay.invoice;
          if (invoice) amountMsats = extractAmountFromInvoice(invoice);
        } else if (op.operationMeta?.variant?.send) {
          type = FMCDTransactionType.LightningSend;
          const invoice = op.operationMeta.variant.send?.invoice;
          if (invoice) amountMsats = extractAmountFromInvoice(invoice);
        }

        if (amountMsats === 0) {
          if (op.operationMeta?.amount_msat) {
            amountMsats = ensureNumber(op.operationMeta.amount_msat);
          } else if (op.outcome?.amount_msat) {
            amountMsats = ensureNumber(op.outcome.amount_msat);
          }
        }
      } else if (op.operationKind === "wallet") {
        if (op.operationMeta?.variant?.deposit) {
          type = FMCDTransactionType.OnchainReceive;
          if (op.outcome?.Claimed?.btc_deposited) {
            amountMsats = op.outcome.Claimed.btc_deposited * 1000;
          }
        } else if (op.operationMeta?.variant?.withdraw) {
          type = FMCDTransactionType.OnchainSend;
          if (op.operationMeta?.amount_sat) {
            amountMsats = ensureNumber(op.operationMeta.amount_sat) * 1000;
          } else if (op.operationMeta?.variant?.withdraw?.amount_sat) {
            amountMsats = ensureNumber(op.operationMeta.variant.withdraw.amount_sat) * 1000;
          }
        }
      }

      // Determine status
      if (op.outcome) {
        if (typeof op.outcome === "string") {
          status =
            op.outcome === "claimed"
              ? FMCDTransactionStatus.Completed
              : FMCDTransactionStatus.Failed;
        } else if (op.outcome.Claimed) {
          status = FMCDTransactionStatus.Completed;
        } else if (op.outcome.canceled || op.outcome.failed) {
          status = FMCDTransactionStatus.Failed;
        }
      }

      return {
        id: op.id?.toString() || `${federationId}-${Date.now()}-${Math.random()}`,
        type,
        amount_msats: amountMsats,
        timestamp: op.creationTime ? new Date(op.creationTime) : new Date(),
        status,
        federation_id: federationId,
        description: op.operationMeta?.description || op.operationKind || "Transaction",
      } as FMCDTransaction;
    });
  } catch (error) {
    console.warn(`Error fetching transactions for federation ${federationId}:`, error);
    return [];
  }
}

// Helper function to aggregate transactions by time periods
function aggregateTransactionsByPeriod(
  transactions: FMCDTransaction[],
  timeframe: "day" | "week" | "month",
  periods: number = 30
): TransactionStats[] {
  const now = new Date();
  const stats: TransactionStats[] = [];

  for (let i = periods - 1; i >= 0; i--) {
    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel: string;

    if (timeframe === "day") {
      periodStart = startOfDay(subDays(now, i));
      periodEnd = endOfDay(periodStart);
      periodLabel = format(periodStart, "yyyy-MM-dd");
    } else if (timeframe === "week") {
      periodStart = startOfWeek(subWeeks(now, i));
      periodEnd = endOfDay(subDays(periodStart, -6)); // End of week
      periodLabel = `${format(periodStart, "MMM dd")} - ${format(endOfDay(subDays(periodStart, -6)), "MMM dd")}`;
    } else {
      periodStart = startOfMonth(subMonths(now, i));
      periodEnd = endOfDay(subDays(startOfMonth(subMonths(now, i - 1)), 1)); // End of month
      periodLabel = format(periodStart, "MMM yyyy");
    }

    const periodTransactions = transactions.filter(
      tx => isAfter(tx.timestamp, periodStart) && isBefore(tx.timestamp, periodEnd)
    );

    const periodStats: TransactionStats = {
      period: periodLabel,
      totalTransactions: periodTransactions.length,
      totalVolumeMsats: 0,
      lightningReceive: 0,
      lightningSend: 0,
      onchainReceive: 0,
      onchainSend: 0,
      ecashMint: 0,
      ecashSpend: 0,
      completedTransactions: 0,
      failedTransactions: 0,
      pendingTransactions: 0,
    };

    periodTransactions.forEach(tx => {
      // Add to total volume only if transaction has completed successfully
      if (tx.status === FMCDTransactionStatus.Completed && tx.amount_msats > 0) {
        periodStats.totalVolumeMsats += tx.amount_msats;
      }

      // Count by transaction type
      switch (tx.type) {
        case FMCDTransactionType.LightningReceive:
          periodStats.lightningReceive++;
          break;
        case FMCDTransactionType.LightningSend:
          periodStats.lightningSend++;
          break;
        case FMCDTransactionType.OnchainReceive:
          periodStats.onchainReceive++;
          break;
        case FMCDTransactionType.OnchainSend:
          periodStats.onchainSend++;
          break;
        case FMCDTransactionType.EcashMint:
          periodStats.ecashMint++;
          break;
        case FMCDTransactionType.EcashSpend:
          periodStats.ecashSpend++;
          break;
      }

      // Count by status
      switch (tx.status) {
        case FMCDTransactionStatus.Completed:
          periodStats.completedTransactions++;
          break;
        case FMCDTransactionStatus.Failed:
          periodStats.failedTransactions++;
          break;
        case FMCDTransactionStatus.Pending:
          periodStats.pendingTransactions++;
          break;
      }
    });

    stats.push(periodStats);
  }

  return stats;
}

export async function GET(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const federationId = searchParams.get("federationId");
    const timeframe = (searchParams.get("timeframe") || "day") as "day" | "week" | "month";
    const periods = Math.min(parseInt(searchParams.get("periods") || "30"), 90);

    if (!federationId) {
      return NextResponse.json({ error: "Federation ID is required" }, { status: 400 });
    }

    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const team = await user.getTeam(params.teamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const config = await getTeamConfig(params.teamId);
    if (!config) {
      return NextResponse.json(
        { error: "No FMCD configuration found for this team" },
        { status: 404 }
      );
    }

    if (!config.isActive) {
      return NextResponse.json({ error: "FMCD configuration is not active" }, { status: 403 });
    }

    // Get federation info to check if federation exists and get its name
    const infoResponse = await fmcdRequest<any>({
      endpoint: "/v2/admin/info",
      config,
      maxRetries: 3,
      timeoutMs: 10000,
    });

    if (infoResponse.error) {
      return NextResponse.json({ error: infoResponse.error }, { status: infoResponse.status });
    }

    if (!infoResponse.data || !infoResponse.data[federationId]) {
      return NextResponse.json({ error: "Federation not found" }, { status: 404 });
    }

    const federationInfo = infoResponse.data[federationId];
    const federationName =
      federationInfo.meta?.federation_name || `Federation ${federationId.slice(0, 8)}`;

    // Fetch all transactions for the federation
    const transactions = await fetchAllFederationTransactions(federationId, config);

    // Aggregate transactions by the specified timeframe
    const stats = aggregateTransactionsByPeriod(transactions, timeframe, periods);

    // Calculate summary statistics
    const totalTransactions = stats.reduce((sum, stat) => sum + stat.totalTransactions, 0);
    const totalVolumeMsats = stats.reduce((sum, stat) => sum + stat.totalVolumeMsats, 0);
    const avgVolumePerPeriod = periods > 0 ? totalVolumeMsats / periods : 0;

    const totalCompleted = stats.reduce((sum, stat) => sum + stat.completedTransactions, 0);
    const totalFailed = stats.reduce((sum, stat) => sum + stat.failedTransactions, 0);
    const successRate =
      totalCompleted + totalFailed > 0
        ? (totalCompleted / (totalCompleted + totalFailed)) * 100
        : 0;

    // Find most active transaction type
    const typeCounts = {
      lightning_receive: stats.reduce((sum, stat) => sum + stat.lightningReceive, 0),
      lightning_send: stats.reduce((sum, stat) => sum + stat.lightningSend, 0),
      onchain_receive: stats.reduce((sum, stat) => sum + stat.onchainReceive, 0),
      onchain_send: stats.reduce((sum, stat) => sum + stat.onchainSend, 0),
      ecash_mint: stats.reduce((sum, stat) => sum + stat.ecashMint, 0),
      ecash_spend: stats.reduce((sum, stat) => sum + stat.ecashSpend, 0),
    };

    const mostActiveType = Object.entries(typeCounts).reduce((a, b) =>
      typeCounts[a[0] as keyof typeof typeCounts] > typeCounts[b[0] as keyof typeof typeCounts]
        ? a
        : b
    )[0];

    const response: StatsResponse = {
      federationId,
      federationName,
      timeframe,
      stats,
      summary: {
        totalTransactions,
        totalVolumeMsats,
        avgVolumePerPeriod,
        mostActiveType,
        successRate,
      },
    };

    console.log(
      `[FMCD Transaction Stats] Generated stats for federation ${federationId} with ${totalTransactions} transactions over ${periods} ${timeframe}s`
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in FMCD transaction stats endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
