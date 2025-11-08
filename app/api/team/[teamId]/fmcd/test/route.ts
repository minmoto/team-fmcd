import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { TestConnectionResponse } from "@/lib/types/fmcd";
import { saveTeamStatus } from "@/lib/storage/team-storage";

async function testFMCDConnection(
  baseUrl: string,
  password: string
): Promise<TestConnectionResponse> {
  try {
    // Create Basic Auth header
    const auth = Buffer.from(`fmcd:${password}`).toString("base64");

    // Test connection to FMCD instance
    const response = await fetch(`${baseUrl}/v2/admin/info`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          isConnected: false,
          error: "Authentication failed - check password",
        };
      }
      return {
        isConnected: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    return {
      isConnected: true,
      version: data.version || "Unknown",
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          isConnected: false,
          error: "Connection timeout - check URL and network",
        };
      }
      return {
        isConnected: false,
        error: error.message,
      };
    }
    return {
      isConnected: false,
      error: "Unknown connection error",
    };
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
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

    // Check team admin permission
    const teamAdminPermission = await user.getPermission(team, "team_admin");

    if (!teamAdminPermission) {
      return NextResponse.json({ error: "Team admin permission required" }, { status: 403 });
    }

    const body = await request.json();
    const { baseUrl, password } = body;

    if (!baseUrl || !password) {
      return NextResponse.json({ error: "Base URL and password are required" }, { status: 400 });
    }

    // Test the connection
    const testResult = await testFMCDConnection(baseUrl, password);

    // Update status in storage
    const now = new Date();
    await saveTeamStatus(params.teamId, {
      isConnected: testResult.isConnected,
      lastChecked: now,
      version: testResult.version,
      error: testResult.error,
    });

    return NextResponse.json(testResult);
  } catch (error) {
    console.error("Error testing FMCD connection:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
