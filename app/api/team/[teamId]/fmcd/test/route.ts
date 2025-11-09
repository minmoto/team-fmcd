import { getStackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { TestConnectionResponse } from "@/lib/types/fmcd";
import { saveTeamStatus } from "@/lib/storage/team-storage";

async function testFMCDConnection(
  baseUrl: string,
  password: string
): Promise<TestConnectionResponse> {
  try {
    // Validate and normalize URL
    let normalizedUrl = baseUrl.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      return {
        isConnected: false,
        error: "Invalid URL format",
        details: "URL must start with http:// or https://",
      };
    }

    // Remove trailing slash
    normalizedUrl = normalizedUrl.replace(/\/$/, "");

    // Create Basic Auth header
    const auth = Buffer.from(`fmcd:${password}`).toString("base64");

    console.log(`[FMCD Test] Testing connection to ${normalizedUrl}/v2/admin/info`);

    // Test connection to FMCD instance with retry
    const maxAttempts = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const timeout = 10000 + (attempt - 1) * 5000; // 10s, then 15s

        const response = await fetch(`${normalizedUrl}/v2/admin/info`, {
          method: "GET",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(timeout),
        });

        if (response.status === 401) {
          console.error("[FMCD Test] Authentication failed");
          return {
            isConnected: false,
            error: "Authentication failed",
            details: "Invalid password. Please check your FMCD credentials.",
          };
        }

        if (response.status === 404) {
          console.error("[FMCD Test] Endpoint not found");
          return {
            isConnected: false,
            error: "Endpoint not found",
            details: "The /v2/admin/info endpoint was not found. Please check your FMCD version.",
          };
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          console.error(`[FMCD Test] HTTP ${response.status}: ${errorText}`);

          // Retry on 5xx errors
          if (response.status >= 500 && attempt < maxAttempts) {
            console.log("[FMCD Test] Server error, retrying...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

          return {
            isConnected: false,
            error: `HTTP ${response.status}`,
            details: errorText || response.statusText,
          };
        }

        // Parse response
        const text = await response.text();
        let data: any;

        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("[FMCD Test] Failed to parse JSON:", text.substring(0, 200));
          return {
            isConnected: false,
            error: "Invalid response format",
            details: "FMCD returned non-JSON response",
          };
        }

        // Extract connection info
        const federationCount = Array.isArray(data.federations) ? data.federations.length : 0;
        const version = data.version || data.network || "Unknown";

        console.log(
          `[FMCD Test] Connection successful - Version: ${version}, Federations: ${federationCount}`
        );

        return {
          isConnected: true,
          version,
          federationCount,
        };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && error.name === "AbortError" && attempt < maxAttempts) {
          console.log("[FMCD Test] Timeout, retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        break;
      }
    }

    // Handle final error
    if (lastError instanceof Error) {
      if (lastError.name === "AbortError") {
        console.error("[FMCD Test] Connection timeout");
        return {
          isConnected: false,
          error: "Connection timeout",
          details: "Unable to reach FMCD instance. Please check the URL and network connectivity.",
        };
      }

      console.error("[FMCD Test] Connection error:", lastError.message);
      return {
        isConnected: false,
        error: "Connection failed",
        details: lastError.message,
      };
    }

    return {
      isConnected: false,
      error: "Unknown error",
      details: "An unexpected error occurred while testing the connection",
    };
  } catch (error) {
    console.error("[FMCD Test] Unexpected error:", error);
    return {
      isConnected: false,
      error: "Test failed",
      details: error instanceof Error ? error.message : "Unknown error",
    };
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
