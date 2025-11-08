import { NextResponse } from "next/server";

/**
 * Health check endpoint for Docker container monitoring
 * Returns basic application health status
 */
export async function GET() {
  try {
    // You can add additional health checks here
    // For example, checking database connectivity, external services, etc.

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.VERSION || "0.1.0",
      checks: {
        app: "ok",
        // Add more checks as needed
        // database: await checkDatabase(),
        // cache: await checkCache(),
      },
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

// Lightweight HEAD request support
export async function HEAD() {
  return new Response(null, { status: 200 });
}
