"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Coins,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  ArrowLeft,
  Network,
  Globe,
  Info,
} from "lucide-react";
import { FMCDInfo, Federation } from "@/lib/types/fmcd";

export default function FederationDetailsPage() {
  const params = useParams<{ teamId: string; federationId: string }>();
  const router = useRouter();
  const [federation, setFederation] = useState<Federation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    async function loadFederation() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/team/${params.teamId}/fmcd/info`);
        if (response.ok) {
          const data: FMCDInfo = await response.json();
          const foundFederation = data.federations.find(
            fed => fed.federation_id === params.federationId
          );

          if (foundFederation) {
            setFederation(foundFederation);
          } else {
            setError("Federation not found");
          }
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
    }

    if (params.teamId && params.federationId) {
      loadFederation();
    }
  }, [params.teamId, params.federationId]);

  const formatSats = (msats: number) => {
    return (msats / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const getConnectionStatus = (federation: Federation) => {
    if (federation.status === "active") {
      return { status: "active", label: "Active", variant: "default" as const, icon: CheckCircle };
    } else if (federation.status === "syncing") {
      return {
        status: "syncing",
        label: "Syncing",
        variant: "secondary" as const,
        icon: AlertTriangle,
      };
    } else if (federation.status === "inactive") {
      return {
        status: "inactive",
        label: "Inactive",
        variant: "destructive" as const,
        icon: XCircle,
      };
    } else {
      return {
        status: "active",
        label: "Connected",
        variant: "default" as const,
        icon: CheckCircle,
      };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" size="icon" disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-2 flex-1">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4"></div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/${params.teamId}/federations`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">Federation Details</h2>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-600">Unable to load federation details</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!federation) {
    return null;
  }

  const connectionStatus = getConnectionStatus(federation);
  const StatusIcon = connectionStatus.icon;
  const federationName = federation.config.global.federation_name || "Unknown Federation";
  const metaExternalUrl = federation.config.global.meta?.meta_external_url;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header with Back Button */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/${params.teamId}/federations`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">{federationName}</h2>
          <p className="text-sm text-muted-foreground">Federation details and information</p>
        </div>
        <Badge variant={connectionStatus.variant} className="h-fit">
          <StatusIcon className="w-3 h-3 mr-1" />
          {connectionStatus.label}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Balance Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatSats(federation.balance_msat)} sats</div>
            <p className="text-xs text-muted-foreground">
              {(federation.balance_msat / 1000).toFixed(8)} BTC
            </p>
          </CardContent>
        </Card>

        {/* Network Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {federation.config.global.network || "Unknown"}
            </div>
            <p className="text-xs text-muted-foreground">Bitcoin network</p>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            <StatusIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectionStatus.label}</div>
            <p className="text-xs text-muted-foreground">Federation is operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Technical Details Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <span>Technical Details</span>
          </CardTitle>
          <CardDescription>Federation configuration and identification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Federation ID */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center space-x-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Federation ID</span>
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(federation.federation_id)}
              >
                {copiedId ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <code className="text-xs break-all font-mono">{federation.federation_id}</code>
            </div>
          </div>

          <Separator />

          {/* Federation Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center space-x-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span>Federation Name</span>
            </label>
            <div className="text-sm">{federationName}</div>
          </div>

          {/* Network */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center space-x-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span>Network</span>
            </label>
            <Badge variant="outline" className="text-xs">
              {federation.config.global.network || "Unknown"}
            </Badge>
          </div>

          {/* External URL if available */}
          {metaExternalUrl && (
            <>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center space-x-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <span>External URL</span>
                </label>
                <a
                  href={metaExternalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center space-x-1"
                >
                  <span>{metaExternalUrl}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Additional Meta Information if available */}
      {federation.config.global.meta && Object.keys(federation.config.global.meta).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>Metadata provided by the federation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(federation.config.global.meta).map(([key, value]) => (
                <div key={key} className="flex justify-between items-start py-2">
                  <span className="text-sm font-medium text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm text-right max-w-[60%] break-words">
                    {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
