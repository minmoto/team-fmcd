"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Coins,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  ArrowRight,
  Plus,
  Zap,
} from "lucide-react";
import { Federation } from "@/lib/types/fmcd";
import { DepositModal } from "@/components/deposit-modal";
import { FederationStatsSummary } from "@/components/federation-stats-summary";
import { AmountDisplayInline } from "@/components/amount-display";

interface FederationCardProps {
  federation: Federation;
}

export function FederationCard({ federation }: FederationCardProps) {
  const params = useParams<{ teamId: string }>();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <CardTitle className="text-base font-medium leading-tight break-words">
            {federation.config.global.federation_name || "Unknown Federation"}
          </CardTitle>
          <Badge variant={connectionStatus.variant} className="shrink-0 self-start">
            <StatusIcon className="w-3 h-3 mr-1" />
            {connectionStatus.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between sm:justify-start space-x-2 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2 min-w-0">
            <Shield className="w-4 h-4 shrink-0" />
            <span className="font-mono text-xs truncate">
              {shortenFederationId(federation.federation_id)}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(federation.federation_id, federation.federation_id)}
            className="p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
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
          <div className="flex items-center space-x-2 min-w-0">
            <Coins className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Balance</span>
          </div>
          <span className="font-semibold text-sm sm:text-base break-all">
            <AmountDisplayInline msats={federation.balance_msat} />
          </span>
        </div>

        {/* Gateway Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Lightning Gateways</span>
          </div>
          <span className="font-medium">{federation.gatewayCount || 0}</span>
        </div>

        {/* Network Info */}
        {federation.config.global.network && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">Network</span>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {federation.config.global.network}
            </Badge>
          </div>
        )}

        {/* Transaction Stats Summary */}
        <FederationStatsSummary
          federationId={federation.federation_id}
          federationName={federation.config.global.federation_name}
        />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex-1 w-full sm:w-auto"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Deposit
          </Button>
          <Button variant="outline" className="flex-1 w-full sm:w-auto" size="sm" asChild>
            <Link href={`/dashboard/${params.teamId}/federations/${federation.federation_id}`}>
              <span className="hidden sm:inline">View Details</span>
              <span className="sm:hidden">Details</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        federation={federation}
      />
    </Card>
  );
}
