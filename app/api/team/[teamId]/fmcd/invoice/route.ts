import { NextRequest, NextResponse } from "next/server";
import { authenticateFMCDRequest, fmcdRequest } from "@/lib/fmcd/utils";

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

    const authResult = await authenticateFMCDRequest(teamId);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { config } = authResult.data;

    const body: InvoiceRequest = await req.json();
    const { federationId, gatewayId, amountMsat, description, expiryTime } = body;

    const response = await fmcdRequest<any>({
      endpoint: "/v2/ln/invoice",
      method: "POST",
      body: {
        federationId,
        gatewayId,
        amountMsat,
        description,
        expiryTime: expiryTime || 3600,
      },
      config,
    });

    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Invoice creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
