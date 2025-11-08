import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { FMCDInfo } from "@/lib/types/fmcd";
import { getTeamConfig } from "@/lib/storage/team-storage";

export async function GET(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const params = await context.params;
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const team = await user.getTeam(params.teamId);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Team members can access FMCD data
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

    try {
      // Create Basic Auth header
      const auth = Buffer.from(`fmcd:${config.password}`).toString("base64");

      // Proxy request to FMCD instance
      const response = await fetch(`${config.baseUrl}/v2/admin/info`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `FMCD error: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      const data: FMCDInfo = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error("Error connecting to FMCD:", error);
      return NextResponse.json({ error: "Failed to connect to FMCD instance" }, { status: 503 });
    }
  } catch (error) {
    console.error("Error in FMCD info endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
