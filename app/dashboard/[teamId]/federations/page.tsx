"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FederationCard } from "@/components/federation-card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { XCircle, AlertTriangle, Network, Plus } from "lucide-react";
import { FMCDInfo } from "@/lib/types/fmcd";

export default function FederationsPage() {
  const params = useParams<{ teamId: string }>();
  const [info, setInfo] = useState<FMCDInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const loadFMCDInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/team/${params.teamId}/fmcd/info`);
      if (response.ok) {
        const data = await response.json();
        setInfo(data);
      } else if (response.status === 404) {
        setError("FMCD not configured");
      } else {
        throw new Error("Failed to load federation info");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params.teamId]);

  useEffect(() => {
    if (params.teamId) {
      loadFMCDInfo();
    }
  }, [params.teamId, loadFMCDInfo]);

  const handleConnectFederation = async () => {
    if (!inviteCode.trim()) {
      setConnectError("Please enter a federation invite code");
      return;
    }

    try {
      setConnectLoading(true);
      setConnectError(null);

      const response = await fetch(`/api/team/${params.teamId}/fmcd/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });

      if (response.ok) {
        // Success - close dialog and reload federation data
        setIsConnectDialogOpen(false);
        setInviteCode("");
        await loadFMCDInfo();
      } else {
        const errorData = await response.json();
        setConnectError(errorData.error || "Failed to connect to federation");
      }
    } catch (err) {
      setConnectError("Network error occurred");
    } finally {
      setConnectLoading(false);
    }
  };

  const handleDialogClose = () => {
    setIsConnectDialogOpen(false);
    setInviteCode("");
    setConnectError(null);
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Federations</h2>
          <div className="flex items-center space-x-2">
            {/* Future: Add federation management actions here */}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-6">
            <Network className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Federation Connections</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Federations</h2>
          <div className="flex items-center space-x-2">
            {/* Future: Add federation management actions here */}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-6">
            <Network className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Federation Connections</h2>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-600">Federation data unavailable</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {error === "FMCD not configured"
                  ? "Configure your FMCD instance in the Configuration page to view federation data."
                  : "Unable to fetch federation information. Please check your FMCD connection."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!info || !info.federations || info.federations.length === 0) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Federations</h2>
          <div className="flex items-center space-x-2">
            {/* Future: Add federation management actions here */}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-6">
            <Network className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Federation Connections</h2>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <span className="text-yellow-600">No federations found</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This FMCD instance is not connected to any federations.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Federations</h2>
        <div className="flex items-center space-x-2">
          <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Connect Federation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect New Federation</DialogTitle>
                <DialogDescription>
                  Enter the federation invite code to connect to a new federation. You can get this code from a federation administrator.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Federation invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !connectLoading) {
                        handleConnectFederation();
                      }
                    }}
                  />
                  {connectError && (
                    <p className="text-sm text-red-600">{connectError}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleDialogClose} disabled={connectLoading}>
                  Cancel
                </Button>
                <Button onClick={handleConnectFederation} disabled={connectLoading || !inviteCode.trim()}>
                  {connectLoading ? "Connecting..." : "Connect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Network className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Federation Connections</h2>
            <Badge variant="secondary" className="ml-2">
              {info.federations.length} federation{info.federations.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {info.federations.map(federation => (
            <FederationCard key={federation.federation_id} federation={federation} />
          ))}
        </div>
      </div>
    </div>
  );
}
