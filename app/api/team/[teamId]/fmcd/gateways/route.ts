import { NextRequest, NextResponse } from "next/server";
import { authenticateFMCDRequest, fmcdRequest } from "@/lib/fmcd/utils";

interface GatewayRequest {
  federationId: string;
}

export async function POST(req: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await context.params;

    const authResult = await authenticateFMCDRequest(teamId);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { config } = authResult.data;

    const body: GatewayRequest = await req.json();
    const { federationId } = body;

    const response = await fmcdRequest<any>({
      endpoint: "/v2/ln/gateways",
      method: "POST",
      body: { federationId },
      config,
    });

    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Gateway fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch gateways" },
      { status: 500 }
    );
  }
}
