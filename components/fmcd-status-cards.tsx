"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Wifi, Bitcoin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FMCDBalance, FMCDInfo } from "@/lib/types/fmcd";
import { Badge } from "@/components/ui/badge";
import { AmountDisplayInline } from "@/components/amount-display";

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


  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="flex-1 p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-semibold">Loading...</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="col-span-full p-2">
        <CardContent className="p-8">
          <div className="flex items-center space-x-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <span className="text-xl font-semibold text-red-600">
              FMCD not configured or unavailable
            </span>
          </div>
          <p className="text-base text-muted-foreground mt-4">
            Configure your FMCD instance in the Configuration page to view Bitcoin data.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!balance && !info) {
    return (
      <Card className="col-span-full p-2">
        <CardContent className="p-8">
          <div className="flex items-center space-x-3">
            <Wifi className="w-8 h-8 text-yellow-500" />
            <span className="text-xl font-semibold text-yellow-600">FMCD not configured</span>
          </div>
          <p className="text-base text-muted-foreground mt-4">
            Configure your FMCD instance in the Configuration page to view Bitcoin data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Connection Status */}
      <Card className="flex-1 p-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">FMCD Status</CardTitle>
          <Wifi className="h-6 w-6 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center space-x-3">
            <Badge
              variant="default"
              className="bg-green-100 text-green-800 px-4 py-2 text-base font-medium"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Connected
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-4 font-medium">
            {info?.network && `Network: ${info.network}`}
          </p>
        </CardContent>
      </Card>

      {/* Federations Count */}
      <Card className="flex-1 p-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Federations</CardTitle>
          <Users className="h-6 w-6 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="text-4xl font-bold mb-2">
            {info?.federations ? info.federations.length : 0}
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {info?.federations && info.federations.length !== 1 ? "federations" : "federation"}{" "}
            connected
          </p>
        </CardContent>
      </Card>

      {/* Total Balance */}
      <Card className="flex-1 p-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Total Balance</CardTitle>
          <Bitcoin className="h-6 w-6 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="text-4xl font-bold mb-2">
            {balance ? <AmountDisplayInline msats={balance.total_msats} /> : "No data"}
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {balance ? "across all federations" : "Across all federations"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
