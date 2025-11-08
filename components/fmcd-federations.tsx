"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Globe, TrendingUp } from "lucide-react";
import { FMCDInfo } from "@/lib/types/fmcd";

export function FMCDFederations() {
  const params = useParams<{ teamId: string }>();
  const [info, setInfo] = useState<FMCDInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFMCDInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/${params.teamId}/fmcd/info`);
      if (response.ok) {
        const data = await response.json();
        setInfo(data);
      }
    } catch (error) {
      console.error("Failed to load FMCD info:", error);
    } finally {
      setLoading(false);
    }
  }, [params.teamId]);

  useEffect(() => {
    if (params.teamId) {
      loadFMCDInfo();
    }
  }, [params.teamId, loadFMCDInfo]);

  const formatSats = (msats: number) => {
    return (msats / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Federations</CardTitle>
          <CardDescription>Loading federation information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!info || !info.federations) {
    return (
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Federations</CardTitle>
          <CardDescription>No federation data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configure your FMCD instance to view federation information.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="w-5 h-5" />
          <span>Federations</span>
        </CardTitle>
        <CardDescription>Connected federations and their status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {info.federations.map((federation, index) => (
            <div
              key={federation.federation_id}
              className="flex items-center justify-between p-4 rounded-lg border"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-medium">
                    {federation.config?.global?.federation_name || `Federation ${index + 1}`}
                  </h4>
                  <Badge variant="outline" className="text-green-600">
                    <Globe className="w-3 h-3 mr-1" />
                    Online
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ID: {federation.federation_id.slice(0, 16)}...
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {formatSats(federation.balance_msat)} sats
                </div>
                <p className="text-xs text-muted-foreground">Balance</p>
              </div>
            </div>
          ))}

          {info.federations.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No federations connected</p>
            </div>
          )}
        </div>

        {info.block_count && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Block Height</span>
              <span className="font-medium">{info.block_count.toLocaleString()}</span>
            </div>
            {info.synced_to && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Synced To</span>
                <span className="font-medium">{info.synced_to.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
