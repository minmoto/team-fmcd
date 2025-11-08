import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { FMCDInfo, Federation } from "@/lib/types/fmcd";
import { getTeamConfig, saveTeamStatus } from "@/lib/storage/team-storage";
import { fmcdRequest, ensureArray, ensureNumber, ensureObject } from "@/lib/fmcd/utils";

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

    // Build the cleaned response
    // Extract network from the first federation since it's not at root level
    const network =
      cleanedFederations.length > 0 ? cleanedFederations[0].config.global.network : "unknown";

    const cleanedData: FMCDInfo = {
      network: network || "unknown",
      federations: cleanedFederations,
    };

    // Update successful connection status
    await saveTeamStatus(params.teamId, {
      isConnected: true,
      lastChecked: new Date(),
      version: cleanedData.network,
      error: undefined,
    });

    console.log(
      `[FMCD Info] Successfully fetched data - ${cleanedData.federations.length} federation(s)`
    );

    return NextResponse.json(cleanedData);
  } catch (error) {
    console.error("Error in FMCD info endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
