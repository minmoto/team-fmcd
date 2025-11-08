import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { getTeamConfig } from "@/lib/storage/team-storage";
import { fmcdRequest } from "@/lib/fmcd/utils";
import { OnchainAddressRequest, OnchainAddressResponse } from "@/lib/types/fmcd";

interface FMCDOnchainAddressResponse {
  address: string;
  operationId?: string;
}

export async function POST(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
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

    // Team members can generate addresses (user.getTeam validates membership)

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

    const body = (await request.json()) as OnchainAddressRequest;
    const { federationId } = body;

    // Prepare the address request body
    const addressRequestBody: any = {};

    // Add optional federationId if provided
    if (federationId) {
      addressRequestBody.federationId = federationId;
    }

    console.log(
      `[FMCD Address] Generating onchain address${federationId ? ` for federation ${federationId}` : ""}`
    );

    // Call the FMCD API to generate the onchain address
    const response = await fmcdRequest<FMCDOnchainAddressResponse>({
      endpoint: "/v2/onchain/address",
      config,
      method: "POST",
      body: addressRequestBody,
      maxRetries: 3,
      timeoutMs: 15000, // Moderate timeout for address generation
    });

    if (response.error) {
      console.error(`[FMCD Address] Failed to generate address:`, response.error);
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    if (!response.data?.address) {
      console.error(`[FMCD Address] No address returned from FMCD`);
      return NextResponse.json(
        {
          error: "No address received from FMCD",
        },
        { status: 502 }
      );
    }

    console.log(`[FMCD Address] Successfully generated onchain address`);

    // Return the address response
    return NextResponse.json<OnchainAddressResponse>({
      success: true,
      address: response.data.address,
      operationId: response.data.operationId,
      federationId: federationId,
    });
  } catch (error) {
    console.error("Error in FMCD address endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
