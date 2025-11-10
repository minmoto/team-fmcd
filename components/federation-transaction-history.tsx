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
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { FMCDTransaction } from "@/lib/types/fmcd";
import { formatDistanceToNow } from "date-fns";
import { AmountDisplayInline } from "@/components/amount-display";

interface FederationTransactionHistoryProps {
  federationId: string;
  network?: string;
  className?: string;
}

export function FederationTransactionHistory({
  federationId,
  network,
  className,
}: FederationTransactionHistoryProps) {
  const params = useParams();
  const teamId = params?.teamId as string;

  const [transactions, setTransactions] = useState<FMCDTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
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

        // Calculate totals for deposits and withdrawals
        let deposits = 0;
        let withdrawals = 0;

        parsedTransactions.forEach((tx: FMCDTransaction) => {
          if (tx.status === "completed" && tx.amount_msats > 0) {
            if (tx.type.includes("receive") || tx.type === "ecash_mint") {
              // Deposits: money coming in
              deposits += tx.amount_msats;
            } else if (tx.type.includes("send") || tx.type === "ecash_spend") {
              // Withdrawals: money going out
              withdrawals += tx.amount_msats;
            }
          }
        });

        setTotalDeposits(deposits);
        setTotalWithdrawals(withdrawals);
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
    return sats.toLocaleString();
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

  const toggleTransactionExpansion = (transactionId: string) => {
    setExpandedTransaction(prev => (prev === transactionId ? null : transactionId));
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const getAddressExplorerUrl = (address: string, networkType?: string) => {
    // Only generate explorer links for onchain transactions with addresses
    if (!networkType || !address) return null;

    const isSignet = networkType.toLowerCase().includes("signet");
    const baseUrl = isSignet ? "https://mutinynet.com" : "https://mempool.space";

    return `${baseUrl}/address/${address}`;
  };

  const renderTransactionDetails = (transaction: FMCDTransaction) => {
    if (expandedTransaction !== transaction.id) return null;

    const truncateId = (id: string, length = 16) => {
      return id.length > length ? `${id.slice(0, length)}...` : id;
    };

    return (
      <div className="mt-3 px-3 sm:px-4 py-3 bg-muted/20">
        <div className="space-y-3 text-sm">
          {/* Transaction Time */}
          <div className="space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="font-medium">Time</span>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(transaction.timestamp, { addSuffix: true })}
              </div>
            </div>
            <div className="text-xs font-mono text-muted-foreground break-all">
              {transaction.timestamp.toLocaleString()}
            </div>
          </div>

          {/* Amount (if pending) */}
          {transaction.amount_msats === 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="font-medium">Amount</span>
              <span className="text-muted-foreground">Pending</span>
            </div>
          )}

          {/* Bitcoin Address for onchain transactions */}
          {transaction.type.includes("onchain") && transaction.address && (
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="font-medium">Bitcoin Address</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(transaction.address!, "address")}
                    className="h-6 w-6 p-0"
                  >
                    {copiedField === "address" ? (
                      <span className="text-green-600 text-xs">✓</span>
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  {network && (
                    <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                      <a
                        href={getAddressExplorerUrl(transaction.address, network) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground break-all">
                <span className="block sm:hidden">{truncateId(transaction.address, 32)}</span>
                <span className="hidden sm:block">{transaction.address}</span>
              </div>
            </div>
          )}

          {/* Transaction ID */}
          <div className="space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="font-medium">Transaction ID</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(transaction.id || "", "id")}
                className="h-6 w-6 p-0 self-start sm:self-center"
              >
                {copiedField === "id" ? (
                  <span className="text-green-600 text-xs">✓</span>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="text-xs font-mono text-muted-foreground break-all">
              <span className="block sm:hidden">{truncateId(transaction.id, 32)}</span>
              <span className="hidden sm:block">{transaction.id}</span>
            </div>
          </div>

          {/* Federation ID */}
          <div className="space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="font-medium">Federation ID</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(transaction.federation_id || "", "federation")}
                className="h-6 w-6 p-0 self-start sm:self-center"
              >
                {copiedField === "federation" ? (
                  <span className="text-green-600 text-xs">✓</span>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="text-xs font-mono text-muted-foreground break-all">
              <span className="block sm:hidden">
                {truncateId(transaction.federation_id || "", 32)}
              </span>
              <span className="hidden sm:block">{transaction.federation_id}</span>
            </div>
          </div>

          {/* Description */}
          {transaction.description && transaction.description !== transaction.type && (
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
              <span className="font-medium">Description</span>
              <span className="text-muted-foreground text-left sm:text-right break-words">
                {transaction.description}
              </span>
            </div>
          )}
        </div>
      </div>
    );
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

        {/* Summary Cards */}
        {!isLoading && transactions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 pt-4 border-t">
            <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex-shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-green-900 dark:text-green-100">
                  Total Deposits
                </p>
                <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                  +<AmountDisplayInline msats={totalDeposits} amountOnly />
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex-shrink-0">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-red-900 dark:text-red-100">
                  Total Withdrawals
                </p>
                <p className="text-sm sm:text-lg font-bold text-red-600 dark:text-red-400">
                  -<AmountDisplayInline msats={totalWithdrawals} amountOnly />
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg sm:col-span-2 lg:col-span-1">
              <div className="flex-shrink-0">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100">Net Change</p>
                <p
                  className={`text-sm sm:text-lg font-bold ${
                    totalDeposits - totalWithdrawals >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {totalDeposits - totalWithdrawals >= 0 ? "+" : ""}
                  <AmountDisplayInline msats={Math.abs(totalDeposits - totalWithdrawals)} amountOnly />
                </p>
              </div>
            </div>
          </div>
        )}
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
              {transactions.map(transaction => {
                const isExpanded = expandedTransaction === transaction.id;
                return (
                  <div key={transaction.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-start sm:items-center justify-between space-x-2 sm:space-x-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleTransactionExpansion(transaction.id)}
                    >
                      <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-0.5 sm:mt-0">{getTransactionIcon(transaction.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <p className="text-sm font-medium truncate">
                              {getTransactionDescription(transaction)}
                            </p>
                            {getStatusBadge(transaction.status)}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground mt-1">
                            <span title={transaction.id} className="truncate">
                              ID: {transaction.id.slice(0, 8)}...
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span title={transaction.timestamp.toLocaleString()} className="truncate">
                              {formatDistanceToNow(transaction.timestamp, { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${transaction.amount_msats === 0 ? "text-muted-foreground" : getTransactionColor(transaction.type)}`}
                          >
                            {transaction.amount_msats === 0 ? (
                              "—"
                            ) : (
                              <>
                                {transaction.type.includes("receive") ||
                                transaction.type === "ecash_mint"
                                  ? "+"
                                  : "-"}
                                <AmountDisplayInline msats={Math.abs(transaction.amount_msats)} amountOnly />
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                    {renderTransactionDetails(transaction)}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t border-border">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">Prev</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <span className="sm:hidden">Next</span>
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground text-center sm:text-right">
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
