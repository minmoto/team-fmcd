import { NextRequest, NextResponse } from "next/server";
import { authenticateFMCDRequest, fmcdRequest } from "@/lib/fmcd/utils";

interface PayInvoiceRequest {
  federationId: string;
  invoice: string;
  gatewayId: string;
  allowOverpay?: boolean;
}

export async function POST(req: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await context.params;

    const authResult = await authenticateFMCDRequest(teamId);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { config } = authResult.data;

    const body: PayInvoiceRequest = await req.json();
    const { federationId, invoice, gatewayId, allowOverpay } = body;

    // Validate request
    if (!federationId || !invoice || !gatewayId) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    // Lightning payments can take 30-60+ seconds, especially for inter-federation transfers
    // Disable retries because FMCD tracks operations and will reject duplicates
    const response = await fmcdRequest<any>({
      endpoint: "/v2/ln/pay",
      method: "POST",
      body: {
        federationId,
        paymentInfo: invoice,
        gatewayId,
      },
      config,
      maxRetries: 1, // No retries - payment operations are tracked by FMCD
      timeoutMs: 60000, // 60 second timeout for Lightning payments
    });

    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Payment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process payment" },
      { status: 500 }
    );
  }
}
