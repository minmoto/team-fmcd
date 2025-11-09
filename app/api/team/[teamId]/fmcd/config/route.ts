import { getStackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import {
  FMCDConfiguration,
  FMCDStatus,
  GetConfigResponse,
  UpdateConfigRequest,
} from "@/lib/types/fmcd";
import {
  getTeamConfig,
  saveTeamConfig,
  getTeamStatus,
  saveTeamStatus,
} from "@/lib/storage/team-storage";

export async function GET(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
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

    // Check team admin permission
    const teamAdminPermission = await user.getPermission(team, "team_admin");

    if (!teamAdminPermission) {
      return NextResponse.json({ error: "Team admin permission required" }, { status: 403 });
    }

    const config = await getTeamConfig(params.teamId);
    const status = (await getTeamStatus(params.teamId)) || {
      isConnected: false,
      lastChecked: new Date(),
      error: config ? "No status available" : "No configuration found",
    };

    const response: GetConfigResponse = {
      config,
      status,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error getting FMCD config:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

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

    // Check team admin permission
    const teamAdminPermission = await user.getPermission(team, "team_admin");

    if (!teamAdminPermission) {
      return NextResponse.json({ error: "Team admin permission required" }, { status: 403 });
    }

    const body: UpdateConfigRequest = await request.json();

    // Validate input
    if (!body.baseUrl || !body.password) {
      return NextResponse.json({ error: "Base URL and password are required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(body.baseUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const existingConfig = await getTeamConfig(params.teamId);
    const now = new Date();

    const config: FMCDConfiguration = {
      teamId: params.teamId,
      baseUrl: body.baseUrl,
      password: body.password,
      isActive: body.isActive,
      createdAt: existingConfig?.createdAt || now,
      updatedAt: now,
      createdBy: existingConfig?.createdBy || user.id,
      lastModifiedBy: user.id,
    };

    await saveTeamConfig(params.teamId, config);

    // Update status to indicate configuration changed
    await saveTeamStatus(params.teamId, {
      isConnected: false,
      lastChecked: now,
      error: "Configuration updated - connection not tested",
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("Error updating FMCD config:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
