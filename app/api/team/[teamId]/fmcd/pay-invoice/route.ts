import { NextRequest, NextResponse } from "next/server";
import { authenticateFMCDRequest, fmcdRequest } from "@/lib/fmcd/utils";

interface PayInvoiceRequest {
  federationId: string;
  invoice: string;
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
    const { federationId, invoice, allowOverpay } = body;

    // Validate request
    if (!federationId || !invoice) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const response = await fmcdRequest<any>({
      endpoint: "/v2/ln/pay",
      method: "POST",
      body: {
        federationId,
        paymentRequest: invoice,
        allowOverpay: allowOverpay || false,
      },
      config,
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
