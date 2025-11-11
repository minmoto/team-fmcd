import { NextRequest, NextResponse } from "next/server";
import { authenticateFMCDRequest, fmcdRequest } from "@/lib/fmcd/utils";

interface LightningAddressRequest {
  federationId: string;
  amountMsat: number;
  description?: string;
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

    const body: LightningAddressRequest = await req.json();
    const { federationId, amountMsat, description, expiryTime } = body;

    // Validate request
    if (!federationId || !amountMsat || amountMsat <= 0) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const response = await fmcdRequest<any>({
      endpoint: "/v2/ln/invoice",
      method: "POST",
      body: {
        federationId,
        amountMsat,
        description: description || `Transfer to federation ${federationId.slice(0, 8)}...`,
        expiryTime: expiryTime || 3600,
      },
      config,
    });

    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Lightning address generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate lightning address" },
      { status: 500 }
    );
  }
}
