import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { FMCDTransaction } from "@/lib/types/fmcd";
import { getTeamConfig } from "@/lib/storage/team-storage";
import { fmcdRequest, ensureNumber } from "@/lib/fmcd/utils";

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
      let type: FMCDTransaction["type"] = "ecash_mint";
      let status: FMCDTransaction["status"] = "pending";

      // Determine transaction type and amount
      if (op.operationKind === "ln") {
        // Lightning operations
        if (op.operationMeta?.variant?.receive) {
          type = "lightning_receive";
          // Try to parse amount from Lightning invoice if available
          const invoice = op.operationMeta.variant.receive.invoice;
          if (invoice) {
            // Extract amount from Lightning invoice using BOLT11 format
            // Format: ln[bc/tb/bcrt][amount][multiplier]
            const match = invoice.match(/ln(?:bc|tb|bcrt)(\d+)([munp]?)/);
            if (match) {
              const baseAmount = parseInt(match[1]);
              const multiplier = match[2];

              // Convert to millisatoshis based on BOLT11 specification
              switch (multiplier) {
                case "m": // milli-bitcoin (0.001 BTC)
                  amountMsats = baseAmount * 100000000; // 1m = 100,000 sats = 100,000,000 msats
                  break;
                case "u": // micro-bitcoin (0.000001 BTC)
                  amountMsats = baseAmount * 100000; // 1u = 100 sats = 100,000 msats
                  break;
                case "n": // nano-bitcoin (0.000000001 BTC)
                  amountMsats = baseAmount * 100; // 1n = 0.1 sats = 100 msats
                  break;
                case "p": // pico-bitcoin (0.000000000001 BTC)
                  amountMsats = baseAmount * 0.1; // 1p = 0.0001 sats = 0.1 msats
                  break;
                default: // no multiplier means entire amount is in sats
                  amountMsats = baseAmount * 1000; // sats to msats
                  break;
              }
            }
          }
        } else if (op.operationMeta?.variant?.pay) {
          type = "lightning_send";
        }
      } else if (op.operationKind === "wallet") {
        // Wallet operations (onchain)
        if (op.operationMeta?.variant?.deposit) {
          type = "onchain_receive";
          // For completed wallet deposits, amount is in outcome.Claimed.btc_deposited (satoshis)
          if (op.outcome?.Claimed?.btc_deposited) {
            amountMsats = op.outcome.Claimed.btc_deposited * 1000; // Convert sats to msats
          }
        } else if (op.operationMeta?.variant?.withdraw) {
          type = "onchain_send";
        }
      }

      // Determine status
      if (op.outcome) {
        if (typeof op.outcome === "string") {
          status = op.outcome === "claimed" ? "completed" : "failed";
        } else if (op.outcome.Claimed) {
          status = "completed";
        } else if (op.outcome.canceled || op.outcome.failed) {
          status = "failed";
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
