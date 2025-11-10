"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { AmountDisplayInline } from "@/components/amount-display";

interface StatsResponse {
  federationId: string;
  federationName?: string;
  timeframe: "day" | "week" | "month";
  summary: {
    totalTransactions: number;
    totalVolumeMsats: number;
    avgVolumePerPeriod: number;
    mostActiveType: string;
    successRate: number;
  };
}

interface FederationStatsSummaryProps {
  federationId: string;
  federationName?: string;
  className?: string;
}

const TRANSACTION_TYPE_LABELS = {
  lightning_receive: "Lightning Receive",
  lightning_send: "Lightning Send",
  onchain_receive: "Onchain Receive",
  onchain_send: "Onchain Send",
  ecash_mint: "Ecash Mint",
  ecash_spend: "Ecash Spend",
};

export function FederationStatsSummary({
  federationId,
  federationName,
  className,
}: FederationStatsSummaryProps) {
  const params = useParams();
  const teamId = params?.teamId as string;

  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !federationId) return;

    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch last 7 days of data for quick overview
        const response = await fetch(
          `/api/team/${teamId}/fmcd/transactions/stats?federationId=${federationId}&timeframe=day&periods=7`
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Federation might not have any transactions yet
            setStatsData({
              federationId,
              federationName: federationName || `Federation ${federationId.slice(0, 8)}`,
              timeframe: "day",
              summary: {
                totalTransactions: 0,
                totalVolumeMsats: 0,
                avgVolumePerPeriod: 0,
                mostActiveType: "none",
                successRate: 0,
              },
            });
            return;
          }

          const errorData = await response.json().catch(() => ({ error: "Failed to fetch" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setStatsData(data);
      } catch (error) {
        console.error("Error fetching federation stats summary:", error);
        setError(error instanceof Error ? error.message : "Failed to load statistics");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [teamId, federationId, federationName]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">Failed to load stats</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!statsData) {
    return null;
  }

  const hasActivity = statsData.summary.totalTransactions > 0;

  return (
    <Card className={`${className} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">7-Day Activity</h3>
            </div>
            <Link
              href={`/dashboard/${teamId}/federations/${federationId}?tab=statistics`}
              className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View Details
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </div>

          {hasActivity ? (
            <>
              {/* Main Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-lg font-bold text-blue-600">
                    {statsData.summary.totalTransactions.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="text-lg font-bold text-green-600">
                    <AmountDisplayInline msats={statsData.summary.totalVolumeMsats} amountOnly />
                  </p>
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">Success rate:</span>
                  <span className="font-medium">
                    {(statsData.summary.successRate ?? 0).toFixed(0)}%
                  </span>
                </div>
                {statsData.summary.mostActiveType !== "none" && (
                  <Badge variant="outline" className="text-xs">
                    {TRANSACTION_TYPE_LABELS[
                      statsData.summary.mostActiveType as keyof typeof TRANSACTION_TYPE_LABELS
                    ] || statsData.summary.mostActiveType}
                  </Badge>
                )}
              </div>

              {/* Daily Average */}
              <div className="text-xs text-muted-foreground">
                Daily avg:{" "}
                <AmountDisplayInline msats={statsData.summary.avgVolumePerPeriod ?? 0} amountOnly />
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
              <p className="text-xs text-muted-foreground">
                Transactions will appear here once you start using this federation
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
