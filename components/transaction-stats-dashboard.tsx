"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Bitcoin,
  Ticket,
  AlertCircle,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import { AmountDisplayInline } from "@/components/amount-display";

interface TransactionStats {
  period: string;
  totalTransactions: number;
  totalVolumeMsats: number;
  lightningReceive: number;
  lightningSend: number;
  onchainReceive: number;
  onchainSend: number;
  ecashMint: number;
  ecashSpend: number;
  completedTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
}

interface StatsResponse {
  federationId: string;
  federationName?: string;
  timeframe: "day" | "week" | "month";
  stats: TransactionStats[];
  summary: {
    totalTransactions: number;
    totalVolumeMsats: number;
    avgVolumePerPeriod: number;
    mostActiveType: string;
    successRate: number;
  };
}

interface TransactionStatsProps {
  federationId: string;
  className?: string;
}

const TRANSACTION_TYPE_COLORS = {
  lightningReceive: "#10b981", // Green
  lightningSend: "#f59e0b", // Orange
  onchainReceive: "#059669", // Emerald
  onchainSend: "#dc2626", // Red
  ecashMint: "#8b5cf6", // Purple
  ecashSpend: "#ec4899", // Pink
};

const TRANSACTION_TYPE_LABELS = {
  lightningReceive: "Lightning Receive",
  lightningSend: "Lightning Send",
  onchainReceive: "Onchain Receive",
  onchainSend: "Onchain Send",
  ecashMint: "Ecash Mint",
  ecashSpend: "Ecash Spend",
};

export function TransactionStatsDashboard({ federationId, className }: TransactionStatsProps) {
  const params = useParams();
  const teamId = params?.teamId as string;

  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month">("day");
  const [periods, setPeriods] = useState<number | "all">(30);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!teamId || !federationId) return;

    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/team/${teamId}/fmcd/transactions/stats?federationId=${federationId}&timeframe=${timeframe}&periods=${periods}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to fetch" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setStatsData(data);
      } catch (error) {
        console.error("Error fetching transaction stats:", error);
        setError(error instanceof Error ? error.message : "Failed to load statistics");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [teamId, federationId, timeframe, periods]);

  const formatPeriodLabel = (period: string) => {
    if (timeframe === "day") {
      return new Date(period).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return period;
  };

  const getFilteredChartData = () => {
    if (!statsData) return [];

    return statsData.stats.map(stat => {
      const data: any = {
        period: formatPeriodLabel(stat.period),
        fullPeriod: stat.period,
        totalTransactions: stat.totalTransactions,
        totalVolumeSats: Math.round(stat.totalVolumeMsats / 1000),
        completed: stat.completedTransactions,
        failed: stat.failedTransactions,
        pending: stat.pendingTransactions,
      };

      // Add transaction type data based on selected filters
      if (selectedTypes.size === 0 || selectedTypes.has("lightningReceive")) {
        data.lightningReceive = stat.lightningReceive;
      }
      if (selectedTypes.size === 0 || selectedTypes.has("lightningSend")) {
        data.lightningSend = stat.lightningSend;
      }
      if (selectedTypes.size === 0 || selectedTypes.has("onchainReceive")) {
        data.onchainReceive = stat.onchainReceive;
      }
      if (selectedTypes.size === 0 || selectedTypes.has("onchainSend")) {
        data.onchainSend = stat.onchainSend;
      }
      if (selectedTypes.size === 0 || selectedTypes.has("ecashMint")) {
        data.ecashMint = stat.ecashMint;
      }
      if (selectedTypes.size === 0 || selectedTypes.has("ecashSpend")) {
        data.ecashSpend = stat.ecashSpend;
      }

      return data;
    });
  };

  const getPieChartData = () => {
    if (!statsData) return [];

    const totalCounts = {
      lightningReceive: statsData.stats.reduce((sum, stat) => sum + stat.lightningReceive, 0),
      lightningSend: statsData.stats.reduce((sum, stat) => sum + stat.lightningSend, 0),
      onchainReceive: statsData.stats.reduce((sum, stat) => sum + stat.onchainReceive, 0),
      onchainSend: statsData.stats.reduce((sum, stat) => sum + stat.onchainSend, 0),
      ecashMint: statsData.stats.reduce((sum, stat) => sum + stat.ecashMint, 0),
      ecashSpend: statsData.stats.reduce((sum, stat) => sum + stat.ecashSpend, 0),
    };

    return Object.entries(totalCounts)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: TRANSACTION_TYPE_LABELS[key as keyof typeof TRANSACTION_TYPE_LABELS],
        value,
        color: TRANSACTION_TYPE_COLORS[key as keyof typeof TRANSACTION_TYPE_COLORS],
      }));
  };

  const toggleTransactionType = (type: string) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const clearAllFilters = () => {
    setSelectedTypes(new Set());
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Transaction Statistics
          </CardTitle>
          <CardDescription>Failed to load transaction statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Transaction Statistics</CardTitle>
          <CardDescription>Loading transaction trends and analytics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!statsData) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Transaction Statistics
            </CardTitle>
            <CardDescription>Trends and analytics for {statsData.federationName}</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              value={timeframe}
              onValueChange={(value: "day" | "week" | "month") => setTimeframe(value)}
            >
              <SelectTrigger className="w-full sm:w-32">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={periods.toString()}
              onValueChange={value => setPeriods(value === "all" ? "all" : parseInt(value))}
            >
              <SelectTrigger className="w-full sm:w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="14">14</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="60">60</SelectItem>
                <SelectItem value="90">90</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Total Transactions
              </p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {statsData.summary.totalTransactions.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Total Volume</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                <AmountDisplayInline msats={statsData.summary.totalVolumeMsats} amountOnly />
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                Avg Per {timeframe === "day" ? "Day" : timeframe === "week" ? "Week" : "Month"}
              </p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                <AmountDisplayInline msats={statsData.summary.avgVolumePerPeriod ?? 0} amountOnly />
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Success Rate
              </p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {(statsData.summary.successRate ?? 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="types">By Type</TabsTrigger>
            <TabsTrigger value="status">By Status</TabsTrigger>
          </TabsList>

          {/* Transaction Type Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedTypes.size === 0 ? "default" : "outline"}
              size="sm"
              onClick={clearAllFilters}
            >
              All Types
            </Button>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
              <Button
                key={key}
                variant={selectedTypes.has(key) || selectedTypes.size === 0 ? "default" : "outline"}
                size="sm"
                onClick={() => toggleTransactionType(key)}
                className="flex items-center gap-1"
              >
                {key.includes("lightning") && <Zap className="h-3 w-3" />}
                {key.includes("onchain") && <Bitcoin className="h-3 w-3" />}
                {key.includes("ecash") && <Ticket className="h-3 w-3" />}
                {label}
              </Button>
            ))}
          </div>

          <TabsContent value="overview" className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getFilteredChartData()}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.fullPeriod || label;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalTransactions"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="volume" className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getFilteredChartData()}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.fullPeriod || label;
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} sats`, "Volume"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalVolumeSats"
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="types" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getFilteredChartData()}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    {(selectedTypes.size === 0 || selectedTypes.has("lightningReceive")) && (
                      <Bar
                        dataKey="lightningReceive"
                        stackId="a"
                        fill={TRANSACTION_TYPE_COLORS.lightningReceive}
                      />
                    )}
                    {(selectedTypes.size === 0 || selectedTypes.has("lightningSend")) && (
                      <Bar
                        dataKey="lightningSend"
                        stackId="a"
                        fill={TRANSACTION_TYPE_COLORS.lightningSend}
                      />
                    )}
                    {(selectedTypes.size === 0 || selectedTypes.has("onchainReceive")) && (
                      <Bar
                        dataKey="onchainReceive"
                        stackId="a"
                        fill={TRANSACTION_TYPE_COLORS.onchainReceive}
                      />
                    )}
                    {(selectedTypes.size === 0 || selectedTypes.has("onchainSend")) && (
                      <Bar
                        dataKey="onchainSend"
                        stackId="a"
                        fill={TRANSACTION_TYPE_COLORS.onchainSend}
                      />
                    )}
                    {(selectedTypes.size === 0 || selectedTypes.has("ecashMint")) && (
                      <Bar
                        dataKey="ecashMint"
                        stackId="a"
                        fill={TRANSACTION_TYPE_COLORS.ecashMint}
                      />
                    )}
                    {(selectedTypes.size === 0 || selectedTypes.has("ecashSpend")) && (
                      <Bar
                        dataKey="ecashSpend"
                        stackId="a"
                        fill={TRANSACTION_TYPE_COLORS.ecashSpend}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getPieChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getPieChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getFilteredChartData()}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="completed" stackId="status" fill="#10b981" name="Completed" />
                  <Bar dataKey="pending" stackId="status" fill="#f59e0b" name="Pending" />
                  <Bar dataKey="failed" stackId="status" fill="#ef4444" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
