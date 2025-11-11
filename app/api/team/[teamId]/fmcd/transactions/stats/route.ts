import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import {
  FMCDTransaction,
  FMCDTransactionType,
  FMCDTransactionStatus,
  Timeframe,
} from "@/lib/types/fmcd";
import { getTeamConfig } from "@/lib/storage/team-storage";
import { fmcdRequest, fetchFederationTransactions } from "@/lib/fmcd/utils";
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
  timeframe: Timeframe;
  stats: TransactionStats[];
  summary: {
    totalTransactions: number;
    totalVolumeMsats: number;
    avgVolumePerPeriod: number;
    mostActiveType: string;
    successRate: number;
  };
}

// Helper function to aggregate transactions by time periods
function aggregateTransactionsByPeriod(
  transactions: FMCDTransaction[],
  timeframe: Timeframe,
  periods: number | "all" = 30
): TransactionStats[] {
  const now = new Date();
  const stats: TransactionStats[] = [];

  // Handle "all" periods case - process all transactions without time windowing
  if (periods === "all") {
    if (transactions.length === 0) {
      return [];
    }

    // Sort transactions by timestamp to get the earliest
    const sortedTransactions = [...transactions].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    const earliestTransaction = sortedTransactions[0];

    // Calculate the number of periods needed to cover all transactions
    let periodCount: number;
    if (timeframe === Timeframe.Day) {
      periodCount =
        Math.ceil(
          (now.getTime() - earliestTransaction.timestamp.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
    } else if (timeframe === Timeframe.Week) {
      periodCount =
        Math.ceil(
          (now.getTime() - earliestTransaction.timestamp.getTime()) / (1000 * 60 * 60 * 24 * 7)
        ) + 1;
    } else {
      // Approximate month calculation
      periodCount =
        Math.ceil(
          (now.getTime() - earliestTransaction.timestamp.getTime()) / (1000 * 60 * 60 * 24 * 30)
        ) + 1;
    }

    // Use the calculated period count for processing
    periods = Math.max(1, periodCount);
  }

  const numPeriods = typeof periods === "number" ? periods : 30;
  for (let i = numPeriods - 1; i >= 0; i--) {
    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel: string;

    if (timeframe === Timeframe.Day) {
      periodStart = startOfDay(subDays(now, i));
      periodEnd = endOfDay(periodStart);
      periodLabel = format(periodStart, "yyyy-MM-dd");
    } else if (timeframe === Timeframe.Week) {
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

    // Only include periods that have transactions (unless we want to show empty periods for context)
    if (periodStats.totalTransactions > 0) {
      stats.push(periodStats);
    }
  }

  return stats;
}

export async function GET(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const federationId = searchParams.get("federationId");
    const timeframe = (searchParams.get("timeframe") || "day") as Timeframe;
    const periodsParam = searchParams.get("periods") || "30";
    const periods = periodsParam === "all" ? "all" : Math.min(parseInt(periodsParam), 90);

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
    const transactions = await fetchFederationTransactions({
      federationId,
      config,
      limit: 100_000_000_000,
      timeoutMs: 10000,
    });

    // Aggregate transactions by the specified timeframe
    const stats = aggregateTransactionsByPeriod(transactions, timeframe, periods);

    // Calculate summary statistics
    const totalTransactions = stats.reduce((sum, stat) => sum + stat.totalTransactions, 0);
    const totalVolumeMsats = stats.reduce((sum, stat) => sum + stat.totalVolumeMsats, 0);
    const periodCount = typeof periods === "number" ? periods : stats.length;
    const avgVolumePerPeriod = periodCount > 0 ? totalVolumeMsats / periodCount : 0;

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
      `[FMCD Transaction Stats] Generated stats for federation ${federationId} with ${totalTransactions} transactions over ${periods === "all" ? "all" : periods} ${timeframe}s`
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in FMCD transaction stats endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
