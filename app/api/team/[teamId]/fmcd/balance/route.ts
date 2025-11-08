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

    // Use the info endpoint to get federation data, which includes balance information
    const response = await fmcdRequest<any>({
      endpoint: "/v2/admin/info",
      config,
      maxRetries: 3,
      timeoutMs: 10000,
    });

    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    if (!response.data) {
      return NextResponse.json({ error: "No balance data received from FMCD" }, { status: 502 });
    }

    // Calculate total balance from all federations
    let totalBalance = 0;

    if (response.data && typeof response.data === "object") {
      Object.values(response.data).forEach((federationData: any) => {
        if (
          federationData &&
          typeof federationData === "object" &&
          federationData.totalAmountMsat
        ) {
          totalBalance += ensureNumber(federationData.totalAmountMsat, 0);
        }
      });
    }

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
