import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";
import { FMCDTransaction } from "@/lib/types/fmcd";
import { getTeamConfig } from "@/lib/storage/team-storage";
import { fmcdRequest, fetchFederationTransactions } from "@/lib/fmcd/utils";

export async function GET(request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 50); // Max 50 transactions
    const federationId = searchParams.get("federationId"); // Optional federation filter
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

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

    // First get federation list from info endpoint
    const infoResponse = await fmcdRequest<any>({
      endpoint: "/v2/admin/info",
      config,
      maxRetries: 3,
      timeoutMs: 10000,
    });

    if (infoResponse.error) {
      return NextResponse.json({ error: infoResponse.error }, { status: infoResponse.status });
    }

    if (!infoResponse.data) {
      return NextResponse.json({ error: "No federation data received from FMCD" }, { status: 502 });
    }

    // Get federation IDs from the info response
    let federationIds = Object.keys(infoResponse.data);

    // Filter to specific federation if requested
    if (federationId) {
      if (federationIds.includes(federationId)) {
        federationIds = [federationId];
      } else {
        return NextResponse.json({ error: "Federation not found" }, { status: 404 });
      }
    }

    if (federationIds.length === 0) {
      return NextResponse.json([]);
    }

    // For federation-specific requests, fetch more transactions to support pagination
    const fetchLimit = federationId ? Math.min(limit * 10, 200) : limit;

    // Fetch transactions for federations in parallel
    const transactionPromises = federationIds.map(fedId =>
      fetchFederationTransactions({
        federationId: fedId,
        config,
        limit: fetchLimit,
        includeAddress: true,
      })
    );

    const federationTransactions = await Promise.all(transactionPromises);

    // Combine all transactions from all federations
    const allTransactions = federationTransactions.flat();

    // Sort by timestamp (newest first)
    const sortedTransactions = allTransactions.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // For federation-specific requests, implement pagination
    if (federationId) {
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

      return NextResponse.json({
        transactions: paginatedTransactions,
        total: sortedTransactions.length,
        page,
        limit,
        totalPages: Math.ceil(sortedTransactions.length / limit),
      });
    }

    // For overview requests, just return the limited set
    const limitedTransactions = sortedTransactions.slice(0, limit);

    console.log(
      `[FMCD Transactions] Successfully fetched ${limitedTransactions.length} transactions from ${federationIds.length} federations`
    );

    return NextResponse.json(limitedTransactions);
  } catch (error) {
    console.error("Error in FMCD transactions endpoint:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
