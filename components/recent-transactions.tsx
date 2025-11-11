"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowUpRight, ArrowDownLeft, Zap, Bitcoin, Ticket } from "lucide-react";
import { FMCDTransaction, FMCDTransactionType, FMCDTransactionStatus } from "@/lib/types/fmcd";
import { formatDistanceToNow } from "date-fns";
import { AmountDisplayInline } from "@/components/amount-display";

interface RecentTransactionsProps {
  className?: string;
}

export function RecentTransactions({ className }: RecentTransactionsProps) {
  const params = useParams();
  const teamId = params?.teamId as string;

  const [transactions, setTransactions] = useState<FMCDTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;

    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/team/${teamId}/fmcd/transactions?limit=5`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to fetch" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // Parse timestamp strings back to Date objects
        const parsedTransactions = data.map((tx: any) => ({
          ...tx,
          timestamp: new Date(tx.timestamp),
        }));

        setTransactions(parsedTransactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        setError(error instanceof Error ? error.message : "Failed to load transactions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [teamId]);

  const getTransactionIcon = (type: FMCDTransaction["type"]) => {
    switch (type) {
      case FMCDTransactionType.LightningReceive:
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case FMCDTransactionType.LightningSend:
        return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
      case FMCDTransactionType.OnchainReceive:
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case FMCDTransactionType.OnchainSend:
        return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
      case FMCDTransactionType.EcashMint:
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case FMCDTransactionType.EcashSpend:
        return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
      default:
        return <ArrowUpRight className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTransactionColor = (type: FMCDTransaction["type"]) => {
    if (type.includes("receive") || type === FMCDTransactionType.EcashMint) {
      return "text-green-600";
    } else if (type.includes("send") || type === FMCDTransactionType.EcashSpend) {
      return "text-red-600";
    }
    return "text-muted-foreground";
  };

  const getStatusBadge = (status: FMCDTransaction["status"]) => {
    switch (status) {
      case FMCDTransactionStatus.Completed:
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            Completed
          </Badge>
        );
      case FMCDTransactionStatus.Pending:
        return <Badge variant="secondary">Pending</Badge>;
      case FMCDTransactionStatus.Failed:
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTransactionDescription = (transaction: FMCDTransaction) => {
    // Return JSX with icon and text for transaction types
    if (transaction.type.includes("lightning")) {
      return (
        <span className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          Lightning
        </span>
      );
    } else if (transaction.type.includes("onchain")) {
      return (
        <span className="flex items-center gap-1.5">
          <Bitcoin className="h-3.5 w-3.5" />
          Onchain
        </span>
      );
    } else if (transaction.type.includes("ecash")) {
      return (
        <span className="flex items-center gap-1.5">
          <Ticket className="h-3.5 w-3.5" />
          Ecash
        </span>
      );
    }

    // Fallback for unknown types
    return transaction.description || "Transaction";
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Recent Transactions
          </CardTitle>
          <CardDescription>Failed to load recent transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Latest 5 transactions across all federations</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No recent transactions found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Transactions will appear here once you start using your federations
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map(transaction => (
              <div
                key={transaction.id}
                className="flex items-center justify-between space-x-3 p-2 rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">{getTransactionIcon(transaction.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {getTransactionDescription(transaction)}
                      </p>
                      {getStatusBadge(transaction.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span title={transaction.federation_id}>
                        Federation: {transaction.federation_id?.slice(0, 8)}...
                      </span>
                      <span>•</span>
                      <span title={transaction.timestamp.toLocaleString()}>
                        {formatDistanceToNow(transaction.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {transaction.amount_msats === 0 ? (
                    <p className="text-sm font-medium text-muted-foreground">-</p>
                  ) : (
                    <div className={`text-sm font-medium ${getTransactionColor(transaction.type)}`}>
                      {transaction.type.includes("receive") ||
                      transaction.type === FMCDTransactionType.EcashMint
                        ? "+"
                        : "-"}
                      <AmountDisplayInline
                        msats={Math.abs(transaction.amount_msats)}
                        className="inline"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground text-center">
                Visit individual federation pages to see detailed transaction history for each
                federation
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
