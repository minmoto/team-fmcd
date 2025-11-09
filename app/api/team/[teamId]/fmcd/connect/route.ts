import { getStackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { getTeamConfig } from "@/lib/storage/team-storage";
import { fmcdRequest } from "@/lib/fmcd/utils";

export async function POST(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const params = await context.params;
    const user = await getStackServerApp().getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const team = await user.getTeam(params.teamId);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Team members can connect to federations (user.getTeam validates membership)

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

    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode || typeof inviteCode !== "string" || !inviteCode.trim()) {
      return NextResponse.json({ error: "Federation invite code is required" }, { status: 400 });
    }

    // Use the FMCD API to connect to the federation
    const response = await fmcdRequest<any>({
      endpoint: "/v2/admin/join",
      config,
      method: "POST",
      body: {
        inviteCode: inviteCode.trim(),
      },
      maxRetries: 3,
      timeoutMs: 30000, // Longer timeout for federation connection
    });

    if (response.error) {
      console.error(`[FMCD Connect] Failed to connect to federation:`, response.error);
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    console.log(`[FMCD Connect] Successfully connected to federation`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Successfully connected to federation",
    });
  } catch (error) {
    console.error("Error in FMCD connect endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
