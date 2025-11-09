import { NextRequest, NextResponse } from "next/server";
import { getStackServerApp } from "@/stack";

interface PayInvoiceRequest {
  federationId: string;
  invoice: string;
  allowOverpay?: boolean;
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

    const body: PayInvoiceRequest = await req.json();
    const { federationId, invoice, allowOverpay } = body;

    // Validate request
    if (!federationId || !invoice) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    // Call FMCD to pay the invoice from the source federation
    const fmcdUrl = `${fmcdConfig.baseUrl}/v2/ln/pay`;
    const fmcdResponse = await fetch(fmcdUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`fmcd:${fmcdConfig.password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        federationId,
        paymentRequest: invoice,
        allowOverpay: allowOverpay || false,
      }),
    });

    if (!fmcdResponse.ok) {
      const errorText = await fmcdResponse.text();
      console.error("FMCD payment error:", fmcdResponse.status, errorText);
      return NextResponse.json(
        { error: `Payment failed: ${fmcdResponse.status} - ${errorText}` },
        { status: fmcdResponse.status }
      );
    }

    const result = await fmcdResponse.json();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Payment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process payment" },
      { status: 500 }
    );
  }
}
