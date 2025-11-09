import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { FMCDInfo, Federation, Gateway, GatewayResponse } from "@/lib/types/fmcd";
import { getTeamConfig, saveTeamStatus } from "@/lib/storage/team-storage";
import { fmcdRequest, ensureArray, ensureNumber, ensureObject } from "@/lib/fmcd/utils";

// Helper function to fetch gateways for a specific federation
async function fetchFederationGateways(
  federationId: string,
  config: any
): Promise<{ gateways: Gateway[]; count: number }> {
  try {
    const response = await fmcdRequest<Gateway[]>({
      endpoint: "/v2/ln/gateways",
      method: "POST",
      body: { federationId },
      config,
      maxRetries: 2,
      timeoutMs: 5000,
    });

    if (response.error || !response.data) {
      console.warn(`Failed to fetch gateways for federation ${federationId}: ${response.error}`);
      return { gateways: [], count: 0 };
    }

    // The API returns an array of gateways directly
    const gateways = response.data || [];
    console.log(`Fetched ${gateways.length} gateways for federation ${federationId}`);
    return { gateways, count: gateways.length };
  } catch (error) {
    console.warn(`Error fetching gateways for federation ${federationId}:`, error);
    return { gateways: [], count: 0 };
  }
}

// Helper function to fetch live balance for a specific federation
async function fetchFederationBalance(
  federationId: string,
  config: any
): Promise<number> {
  try {
    // Try the federation-specific balance endpoint first
    const balanceResponse = await fmcdRequest<any>({
      endpoint: "/v2/fedimint/balance",
      method: "POST",
      body: { federationId },
      config,
      maxRetries: 2,
      timeoutMs: 5000,
    });

    if (balanceResponse.data && typeof balanceResponse.data === 'number') {
      console.log(`Fetched live balance for federation ${federationId}: ${balanceResponse.data} msats`);
      return balanceResponse.data;
    }

    if (balanceResponse.data && balanceResponse.data.balance_msat) {
      console.log(`Fetched live balance for federation ${federationId}: ${balanceResponse.data.balance_msat} msats`);
      return ensureNumber(balanceResponse.data.balance_msat, 0);
    }

    console.warn(`No balance data found for federation ${federationId}`);
    return 0;
  } catch (error) {
    console.warn(`Error fetching live balance for federation ${federationId}:`, error);
    return 0;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const params = await context.params;
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

    // Use the utility function to make the request
    const response = await fmcdRequest<FMCDInfo>({
      endpoint: "/v2/admin/info",
      config,
      maxRetries: 3,
      timeoutMs: 10000,
    });

    if (response.error) {
      // Update status to reflect connection failure
      await saveTeamStatus(params.teamId, {
        isConnected: false,
        lastChecked: new Date(),
        error: response.error,
      });

      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    if (!response.data) {
      return NextResponse.json({ error: "No data received from FMCD" }, { status: 502 });
    }

    // Validate and clean the response data
    const data = response.data;

    // The FMCD API returns federations as an object with federation IDs as keys
    // Convert this to our expected array format
    const cleanedFederations: Federation[] = [];

    if (data && typeof data === "object") {
      Object.entries(data).forEach(([federationId, federationData]: [string, any]) => {
        if (federationData && typeof federationData === "object") {
          cleanedFederations.push({
            federation_id: federationId,
            balance_msat: ensureNumber(federationData.totalAmountMsat, 0),
            config: {
              global: {
                federation_name: federationData.meta?.federation_name || "Unknown Federation",
                meta: federationData.meta || {},
                network: federationData.network || "unknown",
              },
            },
            status: "active" as const, // Assume active if present
          });
        }
      });
    }

    // Fetch gateways and live balances for all federations in parallel
    const federationPromises = cleanedFederations.map(async federation => {
      const [gatewayData, liveBalance] = await Promise.all([
        fetchFederationGateways(federation.federation_id, config),
        fetchFederationBalance(federation.federation_id, config)
      ]);
      
      return {
        federationId: federation.federation_id,
        gateways: gatewayData.gateways,
        gatewayCount: gatewayData.count,
        liveBalance: liveBalance,
      };
    });

    // Wait for all federation requests to complete
    const federationResults = await Promise.all(federationPromises);

    // Add gateway data and live balances to federations
    const federationsWithGateways = cleanedFederations.map(federation => {
      const federationData = federationResults.find(
        result => result.federationId === federation.federation_id
      );

      return {
        ...federation,
        balance_msat: federationData?.liveBalance || federation.balance_msat, // Use live balance if available
        gateways: federationData?.gateways || [],
        gatewayCount: federationData?.gatewayCount || 0,
      };
    });

    // Build the cleaned response
    // Extract network from the first federation since it's not at root level
    const network =
      federationsWithGateways.length > 0
        ? federationsWithGateways[0].config.global.network
        : "unknown";

    const cleanedData: FMCDInfo = {
      network: network || "unknown",
      federations: federationsWithGateways,
    };

    // Update successful connection status
    await saveTeamStatus(params.teamId, {
      isConnected: true,
      lastChecked: new Date(),
      version: cleanedData.network,
      error: undefined,
    });

    console.log(
      `[FMCD Info] Successfully fetched data - ${cleanedData.federations.length} federation(s), total gateways: ${federationsWithGateways.reduce((sum, fed) => sum + fed.gatewayCount!, 0)}`
    );

    return NextResponse.json(cleanedData);
  } catch (error) {
    console.error("Error in FMCD info endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
