import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { FMCDTransaction, FMCDTransactionType, FMCDTransactionStatus } from "@/lib/types/fmcd";
import { getTeamConfig } from "@/lib/storage/team-storage";
import { fmcdRequest, ensureNumber } from "@/lib/fmcd/utils";

/**
 * Extract amount from a Lightning invoice using BOLT11 format
 * Based on the parsing logic from mini API service
 * @param invoice - Lightning invoice string
 * @returns Amount in millisatoshis
 */
function extractAmountFromInvoice(invoice: string): number {
  try {
    // Basic BOLT11 amount extraction
    // Lightning invoices encode amount in the invoice string
    // Format: ln[prefix][amount][unit][separator][data]
    // Example: lntbs100u (100 micro-bitcoin = 100 * 100 sats = 10,000 sats)

    // Support different Lightning invoice formats for different networks
    // lnbc - Bitcoin mainnet, lntb - Bitcoin testnet, lntbs - Bitcoin signet, lnbcrt - Bitcoin regtest
    const match = invoice.match(/ln(bc|tb|tbs|bcrt)(\d+)([munp]?)/);

    if (!match) {
      console.warn(`Could not extract amount from invoice: ${invoice.substring(0, 20)}...`);
      return 0;
    }

    const amount = parseInt(match[2]);
    const unit = match[3];

    // Convert to millisatoshis based on unit
    // Following the exact logic from mini service
    switch (unit) {
      case "m": // milli-bitcoin (mBTC) = 100,000 sats = 100,000,000 msats
        return amount * 100000000;
      case "u": // micro-bitcoin (μBTC) = 100 sats = 100,000 msats
        return amount * 100000;
      case "n": // nano-bitcoin (nBTC) = 0.1 sats = 100 msats
        return Math.floor(amount * 100);
      case "p": // pico-bitcoin (pBTC) = 0.0001 sats = 0.1 msats
        return Math.floor(amount / 10); // Use integer division for precision
      default:
        // If no unit specified, assume base unit (bitcoin)
        // 1 BTC = 100,000,000 sats = 100,000,000,000 msats
        return amount * 100000000000;
    }
  } catch (error) {
    console.error(`Failed to extract amount from invoice: ${error}`);
    return 0;
  }
}

// Helper function to fetch transactions for a specific federation
async function fetchFederationTransactions(
  federationId: string,
  config: any,
  limit: number = 10
): Promise<FMCDTransaction[]> {
  try {
    const response = await fmcdRequest<any>({
      endpoint: "/v2/admin/operations",
      method: "POST",
      body: { federationId, limit },
      config,
      maxRetries: 2,
      timeoutMs: 5000,
    });

    if (response.error || !response.data) {
      console.warn(
        `Failed to fetch transactions for federation ${federationId}: ${response.error}`
      );
      return [];
    }

    // Convert FMCD operations to our transaction format
    // FMCD returns { operations: [...] } due to camelCase serialization
    const operations = response.data.operations || [];

    return operations.map((op: any) => {
      // Extract amount based on operation type and outcome
      let amountMsats = 0;
      let type: FMCDTransaction["type"] = FMCDTransactionType.EcashMint;
      let status: FMCDTransaction["status"] = FMCDTransactionStatus.Pending;
      let address: string | undefined;

      console.log("OPERATIONS");
      console.log(op);

      // Determine transaction type and amount
      if (op.operationKind === "ln") {
        // Lightning operations
        if (op.operationMeta?.variant?.receive) {
          type = FMCDTransactionType.LightningReceive;
          // Try to parse amount from Lightning invoice if available
          const invoice = op.operationMeta.variant.receive.invoice;
          if (invoice) {
            amountMsats = extractAmountFromInvoice(invoice);
          }
        } else if (op.operationMeta?.variant?.pay) {
          type = FMCDTransactionType.LightningSend;
          // Extract amount from the pay invoice
          const invoice = op.operationMeta.variant.pay.invoice;
          if (invoice) {
            amountMsats = extractAmountFromInvoice(invoice);
          }
        } else if (op.operationMeta?.variant?.send) {
          type = FMCDTransactionType.LightningSend;
          // Try variant.send if variant.pay doesn't exist
          const invoice = op.operationMeta.variant.send?.invoice;
          if (invoice) {
            amountMsats = extractAmountFromInvoice(invoice);
          }
        }

        // Fallback: Check for amount in operationMeta or outcome
        if (amountMsats === 0) {
          // Check if there's an amount_msat field in operationMeta
          if (op.operationMeta?.amount_msat) {
            amountMsats = ensureNumber(op.operationMeta.amount_msat);
          }
          // Or check in the outcome for completed transactions
          else if (op.outcome?.amount_msat) {
            amountMsats = ensureNumber(op.outcome.amount_msat);
          }
        }
      } else if (op.operationKind === "wallet") {
        // Wallet operations (onchain)
        if (op.operationMeta?.variant?.deposit) {
          type = FMCDTransactionType.OnchainReceive;
          address = op.operationMeta.variant.deposit.address;
          // For completed wallet deposits, amount is in outcome.Claimed.btc_deposited (satoshis)
          if (op.outcome?.Claimed?.btc_deposited) {
            amountMsats = op.outcome.Claimed.btc_deposited * 1000; // Convert sats to msats
          }
        } else if (op.operationMeta?.variant?.withdraw) {
          type = FMCDTransactionType.OnchainSend;
          address = op.operationMeta.variant.withdraw.address;
          // For withdraw, check amount_sat in operationMeta or variant
          if (op.operationMeta?.amount_sat) {
            amountMsats = ensureNumber(op.operationMeta.amount_sat) * 1000; // Convert sats to msats
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

      const transaction = {
        id: op.id?.toString() || `${federationId}-${Date.now()}-${Math.random()}`,
        type,
        amount_msats: amountMsats,
        timestamp: op.creationTime ? new Date(op.creationTime) : new Date(),
        status,
        federation_id: federationId,
        description: op.operationMeta?.description || op.operationKind || "Transaction",
        address, // Add address for onchain transactions
      } as FMCDTransaction;

      return transaction;
    });
  } catch (error) {
    console.warn(`Error fetching transactions for federation ${federationId}:`, error);
    return [];
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 50); // Max 50 transactions
    const federationId = searchParams.get("federationId"); // Optional federation filter
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const team = await user.getTeam(params.teamId);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Team members can access FMCD data
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

    // First get federation list from info endpoint
    const infoResponse = await fmcdRequest<any>({
      endpoint: "/v2/admin/info",
      config,
      maxRetries: 3,
      timeoutMs: 10000,
    });

    if (infoResponse.error) {
      return NextResponse.json({ error: infoResponse.error }, { status: infoResponse.status });
    }

    if (!infoResponse.data) {
      return NextResponse.json({ error: "No federation data received from FMCD" }, { status: 502 });
    }

    // Get federation IDs from the info response
    let federationIds = Object.keys(infoResponse.data);

    // Filter to specific federation if requested
    if (federationId) {
      if (federationIds.includes(federationId)) {
        federationIds = [federationId];
      } else {
        return NextResponse.json({ error: "Federation not found" }, { status: 404 });
      }
    }

    if (federationIds.length === 0) {
      return NextResponse.json([]);
    }

    // For federation-specific requests, fetch more transactions to support pagination
    const fetchLimit = federationId ? Math.min(limit * 10, 200) : limit;

    // Fetch transactions for federations in parallel
    const transactionPromises = federationIds.map(fedId =>
      fetchFederationTransactions(fedId, config, fetchLimit)
    );

    const federationTransactions = await Promise.all(transactionPromises);

    // Combine all transactions from all federations
    const allTransactions = federationTransactions.flat();

    // Sort by timestamp (newest first)
    const sortedTransactions = allTransactions.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // For federation-specific requests, implement pagination
    if (federationId) {
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

      return NextResponse.json({
        transactions: paginatedTransactions,
        total: sortedTransactions.length,
        page,
        limit,
        totalPages: Math.ceil(sortedTransactions.length / limit),
      });
    }

    // For overview requests, just return the limited set
    const limitedTransactions = sortedTransactions.slice(0, limit);

    console.log(
      `[FMCD Transactions] Successfully fetched ${limitedTransactions.length} transactions from ${federationIds.length} federations`
    );

    return NextResponse.json(limitedTransactions);
  } catch (error) {
    console.error("Error in FMCD transactions endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
