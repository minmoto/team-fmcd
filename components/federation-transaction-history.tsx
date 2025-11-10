"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Bitcoin,
  Ticket,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FMCDTransaction } from "@/lib/types/fmcd";
import { formatDistanceToNow } from "date-fns";

interface FederationTransactionHistoryProps {
  federationId: string;
  className?: string;
}

export function FederationTransactionHistory({
  federationId,
  className,
}: FederationTransactionHistoryProps) {
  const params = useParams();
  const teamId = params?.teamId as string;

  const [transactions, setTransactions] = useState<FMCDTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    if (!teamId || !federationId) return;

    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/team/${teamId}/fmcd/transactions?federationId=${federationId}&limit=${itemsPerPage}&page=${currentPage}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to fetch" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // Parse timestamp strings back to Date objects
        const parsedTransactions = (data.transactions || data).map((tx: any) => ({
          ...tx,
          timestamp: new Date(tx.timestamp),
        }));

        setTransactions(parsedTransactions);
        setTotalTransactions(data.total || parsedTransactions.length);
      } catch (error) {
        console.error("Error fetching federation transactions:", error);
        setError(error instanceof Error ? error.message : "Failed to load transactions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [teamId, federationId, currentPage]);

  const formatAmount = (amountMsats: number) => {
    if (amountMsats === 0) {
      return "-";
    }
    const sats = Math.floor(amountMsats / 1000);
    return sats.toLocaleString() + " sats";
  };

  const getTransactionIcon = (type: FMCDTransaction["type"]) => {
    switch (type) {
      case "lightning_receive":
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case "lightning_send":
        return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
      case "onchain_receive":
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case "onchain_send":
        return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
      case "ecash_mint":
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case "ecash_spend":
        return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
      default:
        return <ArrowUpRight className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTransactionColor = (type: FMCDTransaction["type"]) => {
    if (type.includes("receive") || type === "ecash_mint") {
      return "text-green-600";
    } else if (type.includes("send") || type === "ecash_spend") {
      return "text-red-600";
    }
    return "text-muted-foreground";
  };

  const getStatusBadge = (status: FMCDTransaction["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            Completed
          </Badge>
        );
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
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

  const totalPages = Math.ceil(totalTransactions / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalTransactions);

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Transaction History
          </CardTitle>
          <CardDescription>Failed to load transaction history</CardDescription>
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription>Complete transaction history for this federation</CardDescription>
          </div>
          {!isLoading && totalTransactions > 0 && (
            <div className="text-sm text-muted-foreground">
              {startIndex}–{endIndex} of {totalTransactions.toLocaleString()}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, index) => (
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
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">No transactions found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Transactions will appear here once you start using this federation
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {transactions.map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between space-x-3 p-3 rounded-lg border hover:bg-muted/50"
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
                        <span title={transaction.id}>ID: {transaction.id.slice(0, 8)}...</span>
                        <span>•</span>
                        <span title={transaction.timestamp.toLocaleString()}>
                          {formatDistanceToNow(transaction.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p
                      className={`text-sm font-medium ${transaction.amount_msats === 0 ? "text-muted-foreground" : getTransactionColor(transaction.type)}`}
                    >
                      {transaction.amount_msats === 0
                        ? ""
                        : transaction.type.includes("receive") || transaction.type === "ecash_mint"
                          ? "+"
                          : "-"}
                      {formatAmount(Math.abs(transaction.amount_msats))}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
