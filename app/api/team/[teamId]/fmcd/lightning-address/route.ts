import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack";

interface LightningAddressRequest {
  federationId: string;
  amountMsat: number;
  description?: string;
  expiryTime?: number;
}

export async function POST(req: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await context.params;
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const team = await stackServerApp.getTeam(teamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const fmcdConfig = team.serverMetadata?.fmcdConfig as any;
    if (!fmcdConfig?.isActive || !fmcdConfig?.baseUrl || !fmcdConfig?.password) {
      return NextResponse.json({ error: "FMCD not configured for this team" }, { status: 400 });
    }

    const body: LightningAddressRequest = await req.json();
    const { federationId, amountMsat, description, expiryTime } = body;

    // Validate request
    if (!federationId || !amountMsat || amountMsat <= 0) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    // Call FMCD to create invoice (lightning address) for the destination federation
    const fmcdUrl = `${fmcdConfig.baseUrl}/v2/ln/invoice`;
    const fmcdResponse = await fetch(fmcdUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`fmcd:${fmcdConfig.password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        federationId,
        amountMsat,
        description: description || `Transfer to federation ${federationId.slice(0, 8)}...`,
        expiryTime: expiryTime || 3600, // Default to 1 hour
      }),
    });

    if (!fmcdResponse.ok) {
      const errorText = await fmcdResponse.text();
      console.error("FMCD lightning address error:", fmcdResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to generate lightning address: ${fmcdResponse.status} - ${errorText}` },
        { status: fmcdResponse.status }
      );
    }

    const result = await fmcdResponse.json();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Lightning address generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate lightning address" },
      { status: 500 }
    );
  }
}
