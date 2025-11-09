import { NextRequest, NextResponse } from "next/server";
import { getStackServerApp } from "@/stack";

interface InvoiceRequest {
  federationId: string;
  gatewayId: string;
  amountMsat: number;
  description: string;
  expiryTime?: number;
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

    const body: InvoiceRequest = await req.json();
    const { federationId, gatewayId, amountMsat, description, expiryTime } = body;

    // Call FMCD to create invoice
    const fmcdUrl = `${fmcdConfig.baseUrl}/v2/ln/invoice`;
    const fmcdResponse = await fetch(fmcdUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`fmcd:${fmcdConfig.password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        federationId,
        gatewayId,
        amountMsat,
        description,
        expiryTime: expiryTime || 3600, // Default to 1 hour
      }),
    });

    if (!fmcdResponse.ok) {
      const errorText = await fmcdResponse.text();
      console.error("FMCD invoice error:", fmcdResponse.status, errorText);
      return NextResponse.json(
        { error: `FMCD error: ${fmcdResponse.status} - ${errorText}` },
        { status: fmcdResponse.status }
      );
    }

    const invoice = await fmcdResponse.json();

    return NextResponse.json(invoice);
  } catch (error: any) {
    console.error("Invoice creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
