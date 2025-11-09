import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { FMCDBalance } from "@/lib/types/fmcd";
import { getTeamConfig } from "@/lib/storage/team-storage";
import { fmcdRequest, ensureNumber } from "@/lib/fmcd/utils";

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
    const federationIds = Object.keys(infoResponse.data);
    
    // Fetch live balance for each federation
    const balancePromises = federationIds.map(async federationId => {
      try {
        const balanceResponse = await fmcdRequest<any>({
          endpoint: "/v2/fedimint/balance",
          method: "POST",
          body: { federationId },
          config,
          maxRetries: 2,
          timeoutMs: 5000,
        });

        if (balanceResponse.data && typeof balanceResponse.data === 'number') {
          return balanceResponse.data;
        }

        if (balanceResponse.data && balanceResponse.data.balance_msat) {
          return ensureNumber(balanceResponse.data.balance_msat, 0);
        }

        // Fallback to info endpoint data if balance endpoint fails
        const federationData = infoResponse.data[federationId];
        return ensureNumber(federationData?.totalAmountMsat, 0);
      } catch (error) {
        console.warn(`Error fetching balance for federation ${federationId}:`, error);
        // Fallback to info endpoint data
        const federationData = infoResponse.data[federationId];
        return ensureNumber(federationData?.totalAmountMsat, 0);
      }
    });

    // Wait for all balance requests and sum them up
    const balances = await Promise.all(balancePromises);
    const totalBalance = balances.reduce((sum, balance) => sum + balance, 0);

    // Build balance response (simplified since FMCD doesn't break down by module type)
    const cleanedBalance: FMCDBalance = {
      total_msats: totalBalance,
      ecash_msats: totalBalance, // FMCD primarily manages ecash
      lightning_msats: 0, // Not separately tracked in this API
      onchain_sats: 0, // Not separately tracked in this API
    };

    console.log("[FMCD Balance] Successfully fetched balance data");
    return NextResponse.json(cleanedBalance);
  } catch (error) {
    console.error("Error in FMCD balance endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
