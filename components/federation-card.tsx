"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Coins,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Federation } from "@/lib/types/fmcd";

interface FederationCardProps {
  federation: Federation;
}

export function FederationCard({ federation }: FederationCardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const formatSats = (msats: number) => {
    return (msats / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const shortenFederationId = (id: string) => {
    if (!id) return "unknown";
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
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
      // Default to active if no status is provided
      return {
        status: "active",
        label: "Connected",
        variant: "default" as const,
        icon: CheckCircle,
      };
    }
  };

  const connectionStatus = getConnectionStatus(federation);
  const StatusIcon = connectionStatus.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium leading-tight">
            {federation.config.global.federation_name || "Unknown Federation"}
          </CardTitle>
          <Badge variant={connectionStatus.variant} className="shrink-0">
            <StatusIcon className="w-3 h-3 mr-1" />
            {connectionStatus.label}
          </Badge>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span className="font-mono text-xs">{shortenFederationId(federation.federation_id)}</span>
          <button
            onClick={() => copyToClipboard(federation.federation_id, federation.federation_id)}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title="Copy full Federation ID"
          >
            {copiedId === federation.federation_id ? (
              <CheckCircle className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Balance</span>
          </div>
          <span className="font-semibold">{formatSats(federation.balance_msat)} sats</span>
        </div>

        {/* Network Info */}
        {federation.config.global.network && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Network</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {federation.config.global.network}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
