import { NextRequest, NextResponse } from "next/server";
import { getStackServerApp } from "@/stack";

interface GatewayRequest {
  federationId: string;
}

export async function POST(req: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await context.params;
    const user = await getStackServerApp().getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const team = await getStackServerApp().getTeam(teamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const fmcdConfig = team.serverMetadata?.fmcdConfig as any;
    if (!fmcdConfig?.isActive || !fmcdConfig?.baseUrl || !fmcdConfig?.password) {
      return NextResponse.json({ error: "FMCD not configured for this team" }, { status: 400 });
    }

    const body: GatewayRequest = await req.json();
    const { federationId } = body;

    // Call FMCD to get gateways
    const fmcdUrl = `${fmcdConfig.baseUrl}/v2/ln/gateways`;
    const fmcdResponse = await fetch(fmcdUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`fmcd:${fmcdConfig.password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        federationId: federationId,
      }),
    });

    if (!fmcdResponse.ok) {
      const errorText = await fmcdResponse.text();
      console.error("FMCD gateways error:", fmcdResponse.status, errorText);
      return NextResponse.json(
        { error: `FMCD error: ${fmcdResponse.status} - ${errorText}` },
        { status: fmcdResponse.status }
      );
    }

    const gateways = await fmcdResponse.json();

    return NextResponse.json(gateways);
  } catch (error: any) {
    console.error("Gateway fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch gateways" },
      { status: 500 }
    );
  }
}
