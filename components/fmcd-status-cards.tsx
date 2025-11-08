"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Wifi, Bitcoin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FMCDBalance, FMCDInfo } from "@/lib/types/fmcd";
import { Badge } from "@/components/ui/badge";

export function FMCDStatusCards() {
  const params = useParams<{ teamId: string }>();
  const [balance, setBalance] = useState<FMCDBalance | null>(null);
  const [info, setInfo] = useState<FMCDInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFMCDData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load balance data
      const balanceResponse = await fetch(`/api/team/${params.teamId}/fmcd/balance`);
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setBalance(balanceData);
      } else if (balanceResponse.status !== 404) {
        throw new Error("Failed to load balance");
      }

      // Load info data
      const infoResponse = await fetch(`/api/team/${params.teamId}/fmcd/info`);
      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        setInfo(infoData);
      } else if (infoResponse.status !== 404) {
        throw new Error("Failed to load info");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params.teamId]);

  useEffect(() => {
    if (params.teamId) {
      loadFMCDData();
    }
  }, [params.teamId, loadFMCDData]);

  const formatSats = (msats: number) => {
    return (msats / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="flex-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="col-span-full">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-600">FMCD not configured or unavailable</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Configure your FMCD instance in the Configuration page to view Bitcoin data.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!balance && !info) {
    return (
      <Card className="col-span-full">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Wifi className="w-5 h-5 text-yellow-500" />
            <span className="text-yellow-600">FMCD not configured</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Configure your FMCD instance in the Configuration page to view Bitcoin data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Connection Status */}
      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">FMCD Status</CardTitle>
          <Wifi className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {info?.network && `Network: ${info.network}`}
          </p>
        </CardContent>
      </Card>

      {/* Federations Count */}
      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Federations</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {info?.federations ? info.federations.length : 0}
          </div>
          <p className="text-xs text-muted-foreground">
            {info?.federations && info.federations.length !== 1 ? "federations" : "federation"}{" "}
            connected
          </p>
        </CardContent>
      </Card>

      {/* Total Balance */}
      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
          <Bitcoin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {balance ? `${formatSats(balance.total_msats)} sats` : "No data"}
          </div>
          <p className="text-xs text-muted-foreground">Across all modules</p>
        </CardContent>
      </Card>
    </div>
  );
}
