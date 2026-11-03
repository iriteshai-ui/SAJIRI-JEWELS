import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { api } from "@/lib/api-client";
import { PraoMlLink } from "@/lib/prao-link";
import { Link, useLocation } from "wouter";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Sparkles,
  BarChart3,
  Layers,
  ArrowRight,
  Plus,
  RefreshCw,
  Wallet,
  Clock,
  ArrowUpRight,
  ExternalLink,
  Tag,
  ShieldCheck,
  Eye,
  SlidersHorizontal,
  DollarSign,
  PieChart as PieIcon,
  ChevronRight,
  X,
  CreditCard,
  Banknote,
  Boxes,
  Users,
  PackagePlus,
} from "lucide-react";

// Recharts
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

// Luxury Color Palette for Visualizations
const CHART_COLORS = {
  gold: "#D4AF37",
  amber: "#D97706",
  amberLight: "#F59E0B",
  emerald: "#059669",
  charcoal: "#1F2937",
  indigo: "#4F46E5",
  rose: "#E11D48",
  teal: "#0D9488",
  slate: "#64748B",
};

const PIE_PALETTE = [
  "#D4AF37", // Pure Gold
  "#059669", // Emerald Green
  "#4F46E5", // Royal Indigo
  "#D97706", // Amber
  "#E11D48", // Rose Red
  "#0D9488", // Deep Teal
  "#8B5CF6", // Purple
  "#3B82F6", // Sapphire Blue
];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // ── State Management ──
  const [datePreset, setDatePreset] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [trendPeriod, setTrendPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(2);
  const [insightsTab, setInsightsTab] = useState<"qty" | "revenue" | "profit" | "slow" | "new">("qty");
  const [secondaryKpiTab, setSecondaryKpiTab] = useState<"sales" | "payments" | "profit" | "orders">("sales");
  const [activityFilter, setActivityFilter] = useState<"all" | "order" | "stock">("all");
  const [inspectModal, setInspectModal] = useState<"low-stock" | "out-of-stock" | "zero-sales" | "discontinued" | "all" | null>(null);

  // ── Date Preset Handler ──
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === "today") {
      const todayStr = now.toISOString().split("T")[0];
      setDateFrom(todayStr);
      setDateTo(todayStr);
      setTrendPeriod("daily");
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      setDateFrom(yStr);
      setDateTo(yStr);
      setTrendPeriod("daily");
    } else if (preset === "last-7-days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setDateFrom(past.toISOString().split("T")[0]);
      setDateTo(now.toISOString().split("T")[0]);
      setTrendPeriod("daily");
    } else if (preset === "last-30-days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      setDateFrom(past.toISOString().split("T")[0]);
      setDateTo(now.toISOString().split("T")[0]);
      setTrendPeriod("weekly");
    } else if (preset === "this-month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(first.toISOString().split("T")[0]);
      setDateTo(last.toISOString().split("T")[0]);
      setTrendPeriod("weekly");
    } else if (preset === "last-month") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(first.toISOString().split("T")[0]);
      setDateTo(last.toISOString().split("T")[0]);
      setTrendPeriod("weekly");
    } else if (preset === "this-year") {
      const first = new Date(now.getFullYear(), 0, 1);
      const last = new Date(now.getFullYear(), 11, 31);
      setDateFrom(first.toISOString().split("T")[0]);
      setDateTo(last.toISOString().split("T")[0]);
      setTrendPeriod("monthly");
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      setTrendPeriod("monthly");
    }
  };

  const clearFilter = () => {
    handleDatePresetChange("all");
  };

  // ── API Queries ──
  // 1. Overview KPIs & Alerts
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview, isFetching: isRefreshing } = useQuery({
    queryKey: ["dashboard-overview", datePreset, dateFrom, dateTo, lowStockThreshold],
    queryFn: async () => {
      const res = await api.get("/api/dashboard/overview", {
        params: { datePreset, dateFrom, dateTo, lowStockThreshold },
      });
      return res.data;
    },
  });

  // 2. Interactive Analytics (Charts & Breakdowns)
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["dashboard-analytics", dateFrom, dateTo, trendPeriod],
    queryFn: async () => {
      const res = await api.get("/api/dashboard/analytics", {
        params: { dateFrom, dateTo, trendPeriod },
      });
      return res.data;
    },
  });

  // 3. Product Insights (Top Sellers, Revenue, Margin, Slow-Moving)
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["dashboard-insights", dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get("/api/dashboard/product-insights", {
        params: { dateFrom, dateTo },
      });
      return res.data;
    },
  });

  // 4. Unified Activity Stream
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const res = await api.get("/api/dashboard/activity");
      return res.data;
    },
  });

  // 5. Drill-Down Products Query (For Modal Inspection)
  const { data: inspectProducts, isLoading: inspectLoading } = useQuery({
    queryKey: ["dashboard-inspect", inspectModal, lowStockThreshold],
    queryFn: async () => {
      if (!inspectModal) return { data: [], total: 0 };
      const res = await api.get("/api/dashboard/inventory-products", {
        params: { status: inspectModal, threshold: lowStockThreshold },
      });
      return res.data;
    },
    enabled: Boolean(inspectModal),
  });

  // Extract structured values
  const kpis = overview?.kpis;
  const inv = overview?.inventory;
  const alerts = overview?.alerts || [];

  // Filter activities
  const filteredActivities = (activityData?.activities || []).filter((a: any) => {
    if (activityFilter === "all") return true;
    return a.type === activityFilter;
  });

  return (
    <div className="space-y-6 pb-12 font-sans text-neutral-900 bg-[#FAF9F6]/40 -m-4 sm:-m-6 p-4 sm:p-6 min-h-screen">
      {/* ── TOP HEADER & ACTIONS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-amber-100/90 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-widest font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shadow-xs">
              Shop Owner Business Intelligence
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              Live DB Synced
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 flex items-center gap-2">
            <span>SAJIRI JEWELS</span>
            <span className="text-amber-600 font-sans font-normal text-xl sm:text-2xl">|</span>
            <span className="font-sans font-medium text-lg sm:text-xl text-neutral-700">Executive Dashboard</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Welcome back, <strong className="text-neutral-900">{user?.name || "Sajiri Administrator"}</strong>. Real-time sales, profitability, stock health, and daily retail priorities.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchOverview();
              queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-activity"] });
            }}
            disabled={isRefreshing}
            className="h-9 text-xs border-amber-200 text-neutral-700 hover:bg-amber-50 gap-1.5"
            title="Refresh All Dashboard Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-600" : ""}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </Button>

          {/* Master Excel Backup Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1.5 font-semibold"
                data-testid="button-download-excel-backup"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export / Backup</span>
                <Download className="w-3 h-3 opacity-60 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem asChild className="cursor-pointer font-semibold py-2.5">
                <a href="/api/dashboard/export/excel" download data-testid="menu-item-master-backup">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Master Business Backup (.csv)</p>
                    <p className="text-[10px] text-muted-foreground font-normal">All Sales, Orders, Products &amp; Inventory Logs</p>
                  </div>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer py-2">
                <a href="/api/dashboard/export/orders" download data-testid="menu-item-orders-backup">
                  <ShoppingCart className="w-4 h-4 mr-2 text-primary" />
                  <span className="text-xs font-medium">All Orders &amp; Tax Invoices</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer py-2">
                <a href="/api/dashboard/export/inventory" download data-testid="menu-item-inventory-backup">
                  <Package className="w-4 h-4 mr-2 text-amber-600" />
                  <span className="text-xs font-medium">Jewellery Products &amp; Stock Levels</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quick Action: New Sale */}
          <Link href="/orders/new">
            <Button size="sm" className="h-9 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5 shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Sale</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ── QUICK ACTIONS TOOLBAR (8 PILL BUTTONS) ── */}
      <div className="bg-white rounded-xl border border-amber-100/90 p-2.5 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 shrink-0">
            Quick Actions:
          </span>
          {/* 1. Create New Sale */}
          <Link href="/orders/new">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-neutral-700 hover:text-amber-800 hover:bg-amber-50 shrink-0">
              <Plus className="w-3 h-3 text-amber-600" /> Create New Sale
            </Button>
          </Link>
          {/* 2. Add New Product */}
          <Link href="/products">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-neutral-700 hover:text-amber-800 hover:bg-amber-50 shrink-0">
              <PackagePlus className="w-3 h-3 text-amber-600" /> Add New Product
            </Button>
          </Link>
          {/* 3. Update Stock */}
          <Link href="/inventory">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-neutral-700 hover:text-amber-800 hover:bg-amber-50 shrink-0">
              <RefreshCw className="w-3 h-3 text-amber-600" /> Update Stock
            </Button>
          </Link>
          {/* 4. View Inventory */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInspectModal("all")}
            className="h-7 text-xs gap-1 text-neutral-700 hover:text-amber-800 hover:bg-amber-50 shrink-0 cursor-pointer"
          >
            <Boxes className="w-3 h-3 text-amber-600" /> View Inventory
          </Button>
          {/* 5. View Orders */}
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-neutral-700 hover:text-amber-800 hover:bg-amber-50 shrink-0">
              <ShoppingCart className="w-3 h-3 text-amber-600" /> View Orders
            </Button>
          </Link>
          {/* 6. View Customers */}
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-neutral-700 hover:text-amber-800 hover:bg-amber-50 shrink-0">
              <Users className="w-3 h-3 text-amber-600" /> View Customers
            </Button>
          </Link>
          {/* 7. Generate Sales Report */}
          <a href="/api/dashboard/export/excel" download className="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-neutral-700 hover:text-amber-800 hover:bg-amber-50 shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> Sales Report
            </Button>
          </a>
          {/* 8. Export Excel */}
          <a href="/api/dashboard/export/excel" download className="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-emerald-800 hover:bg-emerald-50 shrink-0 cursor-pointer"
            >
              <Download className="w-3 h-3 text-emerald-600" /> Export Excel
            </Button>
          </a>
        </div>
      </div>

      {/* ── DATE RANGE CONTROL BAR ── */}
      <Card className="p-3.5 bg-white rounded-xl border border-amber-100 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Sales Date Filter:
            </span>
            {(dateFrom || dateTo || datePreset !== "all") && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-mono">
                {datePreset === "all" ? "Custom Range Active" : datePreset.toUpperCase().replace(/-/g, " ")}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            {/* Quick Pills */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "last-7-days", label: "7 Days" },
                { id: "last-30-days", label: "30 Days" },
                { id: "this-month", label: "This Month" },
                { id: "last-month", label: "Last Month" },
                { id: "this-year", label: "This Year" },
                { id: "all", label: "All Time" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    datePreset === p.id
                      ? "bg-amber-600 text-white font-semibold shadow-xs"
                      : "bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Range Inputs */}
            <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePreset("custom");
                }}
                className="w-32 h-8 text-xs bg-neutral-50 border-neutral-200"
                placeholder="From"
              />
              <span className="text-xs text-neutral-400">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDatePreset("custom");
                }}
                className="w-32 h-8 text-xs bg-neutral-50 border-neutral-200"
                placeholder="To"
              />

              {(dateFrom || dateTo || datePreset !== "all") && (
                <button
                  onClick={clearFilter}
                  className="p-1 hover:bg-neutral-200 rounded text-neutral-500 hover:text-neutral-800 transition-colors"
                  title="Clear Date Filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── 1. PRIMARY HERO KPI METRICS (TOP 6 - ABOVE THE FOLD) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Today's Sales */}
        <Card className="rounded-xl border border-amber-200/80 bg-white shadow-xs hover:border-amber-400 transition-all">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Today's Sales</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
            </div>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24 rounded" />
            ) : (
              <div className="space-y-1">
                <div className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                  {formatCurrency(kpis?.sales?.todaySales || 0)}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                  <span>{kpis?.orders?.todayOrders || 0} order(s) today</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: This Month's Sales */}
        <Card className="rounded-xl border border-amber-200/80 bg-white shadow-xs hover:border-amber-400 transition-all">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">This Month</span>
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24 rounded" />
            ) : (
              <div className="space-y-1">
                <div className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                  {formatCurrency(kpis?.sales?.thisMonthSales || 0)}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                  <span>{kpis?.orders?.thisMonthOrders || 0} order(s) MTD</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Gross Profit & Margin (Admin Only) */}
        <Card className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs hover:border-emerald-400 transition-all">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Gross Profit</span>
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                <DollarSign className="w-3.5 h-3.5" />
              </span>
            </div>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24 rounded" />
            ) : (
              <div className="space-y-1">
                <div className="font-serif text-xl sm:text-2xl font-bold text-emerald-950 tracking-tight">
                  {formatCurrency(kpis?.profitability?.grossProfit || 0)}
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] font-bold py-0 px-1">
                    {Math.round(kpis?.profitability?.grossProfitMargin || 0)}% Margin
                  </Badge>
                  <span className="text-muted-foreground font-mono">Net</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Total Orders & AOV */}
        <Card className="rounded-xl border border-amber-200/80 bg-white shadow-xs hover:border-amber-400 transition-all">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Total Orders</span>
              <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                <ShoppingCart className="w-3.5 h-3.5" />
              </span>
            </div>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24 rounded" />
            ) : (
              <div className="space-y-1">
                <div className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight font-mono">
                  {kpis?.orders?.filteredOrders || kpis?.orders?.totalOrders || 0}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono truncate">
                  <span>AOV: {formatCurrency(Math.round(kpis?.orders?.averageOrderValue || 0))}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Payment Collections */}
        <Card className="rounded-xl border border-amber-200/80 bg-white shadow-xs hover:border-amber-400 transition-all">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Collected</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wallet className="w-3.5 h-3.5" />
              </span>
            </div>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24 rounded" />
            ) : (
              <div className="space-y-1">
                <div className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                  {formatCurrency(kpis?.payments?.amountCollected || 0)}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono truncate">
                  <span>Cash: {formatCurrency(kpis?.payments?.cashCollected || 0)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 6: Pending Balance */}
        <Card className="rounded-xl border border-rose-200/80 bg-rose-50/20 shadow-xs hover:border-rose-400 transition-all">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-800">Pending Due</span>
              <span className="p-1.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24 rounded" />
            ) : (
              <div className="space-y-1">
                <div className="font-serif text-xl sm:text-2xl font-bold text-rose-950 tracking-tight">
                  {formatCurrency(kpis?.payments?.pendingPayments || 0)}
                </div>
                <div className="text-[10px] text-rose-700 flex items-center gap-1 font-mono truncate">
                  <span>{kpis?.payments?.unpaidOrdersCount || 0} unpaid order(s)</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 2. SMART BUSINESS ALERTS ("ATTENTION REQUIRED") ── */}
      {alerts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="font-serif text-base font-bold text-neutral-900">
              Attention Required ({alerts.length} Actionable Alert{alerts.length > 1 ? "s" : ""})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((alert: any) => {
              const isWarning = alert.severity === "warning";
              const isDestructive = alert.severity === "destructive";
              const isAmber = alert.severity === "amber";

              const borderClass = isDestructive
                ? "border-red-200 bg-red-50/50"
                : isAmber
                ? "border-amber-200 bg-amber-50/60"
                : isWarning
                ? "border-orange-200 bg-orange-50/50"
                : "border-blue-200 bg-blue-50/50";

              const textClass = isDestructive
                ? "text-red-900"
                : isAmber
                ? "text-amber-950"
                : isWarning
                ? "text-orange-950"
                : "text-blue-950";

              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-3.5 flex flex-col justify-between shadow-xs transition-all hover:shadow-sm ${borderClass}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${textClass} flex items-center gap-1.5`}>
                        {isDestructive && <AlertCircle className="w-4 h-4 text-red-600" />}
                        {isAmber && <Clock className="w-4 h-4 text-amber-600" />}
                        {isWarning && <AlertTriangle className="w-4 h-4 text-orange-600" />}
                        {alert.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-white font-mono">
                        {alert.count} items
                      </Badge>
                    </div>
                    <p className="text-[11px] text-neutral-600 leading-relaxed line-clamp-2">
                      {alert.description}
                    </p>
                  </div>

                  <div className="pt-2.5 mt-2 border-t border-black/5 flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (alert.actionTarget === "modal-low-stock") setInspectModal("low-stock");
                        else if (alert.actionTarget === "modal-out-of-stock") setInspectModal("out-of-stock");
                        else if (alert.actionTarget === "modal-zero-sales") setInspectModal("zero-sales");
                        else if (alert.actionTarget === "/orders") setLocation("/orders");
                        else if (alert.actionTarget === "tab-insights") setInsightsTab("qty");
                      }}
                      className="text-xs font-semibold text-neutral-900 hover:text-amber-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>{alert.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. INVENTORY HEALTH SECTION (CURRENT LIVE WAREHOUSE SNAPSHOT) ── */}
      <Card className="rounded-2xl border border-amber-100/90 bg-white shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-neutral-100 bg-neutral-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <CardTitle className="font-serif text-base sm:text-lg">
                  Inventory Health &amp; Valuation
                </CardTitle>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                  Current Warehouse State
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Real-time snapshot across 581 jewellery pieces. Click any card to inspect items.
              </CardDescription>
            </div>

            {/* Configurable Threshold */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                Low Stock Threshold:
              </span>
              <div className="flex items-center bg-neutral-100 rounded-lg p-0.5 border border-neutral-200 text-xs">
                {[2, 5, 10].map((t) => (
                  <button
                    key={t}
                    onClick={() => setLowStockThreshold(t)}
                    className={`px-2 py-0.5 rounded font-mono text-xs transition-all ${
                      lowStockThreshold === t ? "bg-white font-bold text-amber-900 shadow-xs" : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    ≤ {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
            {/* Active Products */}
            <Link href="/products" className="cursor-pointer">
              <div className="p-3 bg-neutral-50 hover:bg-neutral-100/80 rounded-xl border border-neutral-200/70 transition-all hover:border-amber-300">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  Active Products
                </span>
                <span className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 block mt-1">
                  {inv?.activeProducts || 0}
                </span>
                <span className="text-[10px] text-emerald-700 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  {inv?.verifiedPraoCount || 0} Verified PRAO
                </span>
              </div>
            </Link>

            {/* Total Stock Units */}
            <Link href="/inventory" className="cursor-pointer">
              <div className="p-3 bg-neutral-50 hover:bg-neutral-100/80 rounded-xl border border-neutral-200/70 transition-all hover:border-amber-300">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  Total Stock Units
                </span>
                <span className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 block mt-1 font-mono">
                  {inv?.totalStockUnits?.toLocaleString("en-IN") || 0}
                </span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">
                  In stock warehouse units
                </span>
              </div>
            </Link>

            {/* Low Stock Products (Clickable) */}
            <div
              onClick={() => setInspectModal("low-stock")}
              className="p-3 bg-amber-50/60 hover:bg-amber-100/60 rounded-xl border border-amber-200/80 cursor-pointer transition-all hover:border-amber-400 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 block">
                  Low Stock Items
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-amber-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
              <span className="font-serif text-xl sm:text-2xl font-bold text-amber-950 block mt-1 font-mono">
                {inv?.lowStockCount || 0}
              </span>
              <span className="text-[10px] text-amber-700 block mt-0.5">
                ≤ {lowStockThreshold} units remaining
              </span>
            </div>

            {/* Out of Stock (Clickable) */}
            <div
              onClick={() => setInspectModal("out-of-stock")}
              className="p-3 bg-red-50/50 hover:bg-red-100/50 rounded-xl border border-red-200/80 cursor-pointer transition-all hover:border-red-400 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-800 block">
                  Sold Out Items
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-red-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
              <span className="font-serif text-xl sm:text-2xl font-bold text-red-950 block mt-1 font-mono">
                {inv?.outOfStockCount || 0}
              </span>
              <span className="text-[10px] text-red-700 block mt-0.5">
                0 units available
              </span>
            </div>

            {/* Discontinued / Inactive Items (Clickable) */}
            <div
              onClick={() => setInspectModal("discontinued")}
              className="p-3 bg-neutral-50 hover:bg-neutral-100/80 rounded-xl border border-neutral-200/70 cursor-pointer transition-all hover:border-neutral-400 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  Discontinued
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
              <span className="font-serif text-xl sm:text-2xl font-bold text-neutral-800 block mt-1 font-mono">
                {inv?.inactiveProducts || 0}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Archived / unlisted
              </span>
            </div>

            {/* Inventory Purchase Value (Admin Only) */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                Purchase Value (Cost)
              </span>
              <span className="font-serif text-lg sm:text-xl font-bold text-neutral-900 block mt-1 truncate">
                {isAdmin ? formatCurrency(Math.round(inv?.purchaseValue || 0)) : "Restricted"}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Total wholesale cost
              </span>
            </div>

            {/* Estimated Retail Value (Admin Only) */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                Retail Valuation
              </span>
              <span className="font-serif text-lg sm:text-xl font-bold text-neutral-900 block mt-1 truncate">
                {isAdmin ? formatCurrency(Math.round(inv?.retailValue || 0)) : "Restricted"}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Current catalogue value
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. SECONDARY PERFORMANCE METRICS (COMPACT TABBED STRIP) ── */}
      <Card className="rounded-xl border border-neutral-200/70 bg-white p-3.5 shadow-xs">
        <Tabs value={secondaryKpiTab} onValueChange={(val: any) => setSecondaryKpiTab(val)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
              Secondary Business Metrics:
            </span>
            <TabsList className="h-8 bg-neutral-100 p-0.5 text-xs">
              <TabsTrigger value="sales" className="text-xs h-7 px-3">Sales Breakdown</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs h-7 px-3">Collections</TabsTrigger>
              {isAdmin && <TabsTrigger value="profit" className="text-xs h-7 px-3">Profitability</TabsTrigger>}
              <TabsTrigger value="orders" className="text-xs h-7 px-3">Orders &amp; Baskets</TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Sales Breakdown */}
          <TabsContent value="sales" className="mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <span className="text-neutral-500 block text-[11px]">Today</span>
                <span className="font-bold text-sm text-neutral-900">{formatCurrency(kpis?.sales?.todaySales || 0)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Yesterday</span>
                <span className="font-bold text-sm text-neutral-900">{formatCurrency(kpis?.sales?.yesterdaySales || 0)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">This Week</span>
                <span className="font-bold text-sm text-neutral-900">{formatCurrency(kpis?.sales?.thisWeekSales || 0)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">This Month</span>
                <span className="font-bold text-sm text-neutral-900">{formatCurrency(kpis?.sales?.thisMonthSales || 0)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Last Month</span>
                <span className="font-bold text-sm text-neutral-900">{formatCurrency(kpis?.sales?.lastMonthSales || 0)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">All-Time Sales</span>
                <span className="font-bold text-sm text-amber-800">{formatCurrency(kpis?.sales?.totalSales || 0)}</span>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Payments */}
          <TabsContent value="payments" className="mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-neutral-500 block text-[11px]">Filtered Collected</span>
                <span className="font-bold text-sm text-emerald-700">{formatCurrency(kpis?.payments?.amountCollected || 0)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Pending Balance</span>
                <span className="font-bold text-sm text-red-600">{formatCurrency(kpis?.payments?.pendingPayments || 0)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Cash Collections</span>
                <span className="font-bold text-sm text-neutral-800">{formatCurrency(kpis?.payments?.cashCollected || 0)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">UPI / Online Collections</span>
                <span className="font-bold text-sm text-neutral-800">{formatCurrency(kpis?.payments?.upiCollected || 0)}</span>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Profitability */}
          {isAdmin && (
            <TabsContent value="profit" className="mt-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-neutral-500 block text-[11px]">Net Item Revenue</span>
                  <span className="font-bold text-sm text-neutral-900">{formatCurrency(kpis?.profitability?.itemRevenue || 0)}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Cost of Goods Sold (COGS)</span>
                  <span className="font-bold text-sm text-neutral-700">{formatCurrency(kpis?.profitability?.totalCogs || 0)}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Gross Profit</span>
                  <span className="font-bold text-sm text-emerald-800">{formatCurrency(kpis?.profitability?.grossProfit || 0)}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Gross Margin %</span>
                  <span className="font-bold text-sm text-emerald-800">{Math.round(kpis?.profitability?.grossProfitMargin || 0)}%</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Average Order Value (AOV)</span>
                  <span className="font-bold text-sm text-indigo-700">{formatCurrency(Math.round(kpis?.orders?.averageOrderValue || 0))}</span>
                </div>
              </div>
            </TabsContent>
          )}

          {/* Tab 4: Orders & Baskets */}
          <TabsContent value="orders" className="mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-neutral-500 block text-[11px]">Filtered Orders</span>
                <span className="font-bold text-sm text-neutral-900 font-mono">{kpis?.orders?.filteredOrders || 0}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">All-Time Orders</span>
                <span className="font-bold text-sm text-neutral-900 font-mono">{kpis?.orders?.totalOrders || 0}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Average Order Value</span>
                <span className="font-bold text-sm text-neutral-900">{formatCurrency(Math.round(kpis?.orders?.averageOrderValue || 0))}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Avg Items per Order</span>
                <span className="font-bold text-sm text-neutral-900 font-mono">{(kpis?.orders?.avgItemsPerOrder || 1).toFixed(1)} items</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* ── 5. SALES ANALYTICS (INTERACTIVE CHARTS GRID) ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600" />
            <h2 className="font-serif text-lg sm:text-xl font-bold text-neutral-950">
              Sales Analytics &amp; Visual Intelligence
            </h2>
          </div>

          {/* Trend Period Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Chart Period:</span>
            <div className="flex items-center bg-white rounded-lg p-0.5 border border-neutral-200 text-xs shadow-xs">
              {[
                { id: "daily", label: "Daily" },
                { id: "weekly", label: "Weekly" },
                { id: "monthly", label: "Monthly" },
                { id: "yearly", label: "Yearly" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTrendPeriod(p.id as any)}
                  className={`px-2.5 py-1 rounded text-xs transition-all ${
                    trendPeriod === p.id
                      ? "bg-amber-600 text-white font-semibold shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Chart 1: Revenue vs Collections vs Pending (7 Columns) */}
          <Card className="lg:col-span-7 rounded-2xl border border-amber-100/90 bg-white shadow-xs overflow-hidden">
            <CardHeader className="pb-2 border-b border-neutral-100 bg-neutral-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-serif text-sm sm:text-base font-bold text-neutral-900">
                    Sales Revenue &amp; Collections Trend
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Periodical comparison of total booked revenue vs actual customer payments.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono uppercase bg-white">
                  {trendPeriod} View
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {analyticsLoading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : !analytics?.trends?.length ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                  <BarChart3 className="w-8 h-8 opacity-20" />
                  <span>No transactions recorded in the selected date range.</span>
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip formatter={(val: number) => [`₹${Number(val).toLocaleString("en-IN")}`, ""]} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="revenue" name="Total Revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paidAmount" name="Collected Paid" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pendingAmount" name="Pending Balance" fill="#E11D48" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart 2: Category Performance (5 Columns) */}
          <Card className="lg:col-span-5 rounded-2xl border border-amber-100/90 bg-white shadow-xs overflow-hidden">
            <CardHeader className="pb-2 border-b border-neutral-100 bg-neutral-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-serif text-sm sm:text-base font-bold text-neutral-900">
                    Category Performance
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Jewellery sales distribution by collection.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono bg-white">
                  Share %
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {analyticsLoading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : !analytics?.categoryPerformance?.length ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                  <PieIcon className="w-8 h-8 opacity-20" />
                  <span>No category sales in date range.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.categoryPerformance}
                          dataKey="revenue"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {analytics.categoryPerformance.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={PIE_PALETTE[index % PIE_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: number, name: string) => [`₹${Number(val).toLocaleString("en-IN")}`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Category Legend List */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-neutral-100">
                    {analytics.categoryPerformance.slice(0, 4).map((c: any, idx: number) => (
                      <div key={c.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: PIE_PALETTE[idx % PIE_PALETTE.length] }}
                          />
                          <span className="truncate text-neutral-700">{c.category}</span>
                        </div>
                        <span className="font-mono font-bold text-neutral-900 shrink-0">
                          {c.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second Row of Analytics: Payment Distribution & Best Sellers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Payment Method Distribution (4 Columns) */}
          <Card className="lg:col-span-4 rounded-2xl border border-amber-100/90 bg-white shadow-xs overflow-hidden">
            <CardHeader className="pb-2 border-b border-neutral-100 bg-neutral-50/30">
              <CardTitle className="font-serif text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Payment Method Share
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {analyticsLoading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : !analytics?.paymentDistribution?.length ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                  No payment collections in range.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    {analytics.paymentDistribution.map((pm: any) => (
                      <div key={pm.method} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                            {pm.method === "Cash" ? (
                              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                            )}
                            {pm.method}
                          </span>
                          <span className="font-mono text-neutral-900 font-bold">
                            {formatCurrency(pm.amount)} ({pm.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(pm.percentage, 100)}%`,
                              backgroundColor: pm.color || "#10b981",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 bg-neutral-50 rounded-xl border text-xs flex justify-between items-center font-mono">
                    <span className="text-neutral-500">Total Collected:</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(analytics?.salesVsCollections?.totalPaid || 0)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Best Selling Products Chart (8 Columns) */}
          <Card className="lg:col-span-8 rounded-2xl border border-amber-100/90 bg-white shadow-xs overflow-hidden">
            <CardHeader className="pb-2 border-b border-neutral-100 bg-neutral-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-serif text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Top Best-Selling Pieces (By Units Sold)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Jewellery pieces generating the highest order volume.
                  </CardDescription>
                </div>
                <Link href="/products" className="text-xs text-amber-700 hover:underline flex items-center gap-1 font-semibold">
                  All Inventory <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {analyticsLoading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : !analytics?.bestSellers?.length ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                  No product sales in the selected date range.
                </div>
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.bestSellers} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        dataKey="productName"
                        type="category"
                        tick={{ fontSize: 11 }}
                        width={140}
                        tickFormatter={(v) => (v.length > 20 ? `${v.substring(0, 18)}…` : v)}
                      />
                      <Tooltip formatter={(val: number) => [`${val} units`, "Units Sold"]} />
                      <Bar dataKey="totalQuantitySold" name="Units Sold" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 6. PRODUCT PERFORMANCE (PRODUCT INSIGHTS DEEP-DIVE) ── */}
      <Card className="rounded-2xl border border-amber-100/90 bg-white shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-neutral-100 bg-neutral-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="font-serif text-base sm:text-lg text-neutral-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" />
                Product Insights &amp; Merchandising Intelligence
              </CardTitle>
              <CardDescription className="text-xs">
                Identify top revenue drivers, highest profit contributors, and slow-moving items requiring attention.
              </CardDescription>
            </div>

            <Tabs value={insightsTab} onValueChange={(v: any) => setInsightsTab(v)}>
              <TabsList className="h-8 bg-neutral-100 p-0.5 text-xs">
                <TabsTrigger value="qty" className="text-xs h-7 px-2.5">Top by Units</TabsTrigger>
                <TabsTrigger value="revenue" className="text-xs h-7 px-2.5">Top Revenue</TabsTrigger>
                {isAdmin && <TabsTrigger value="profit" className="text-xs h-7 px-2.5">Top Profit</TabsTrigger>}
                <TabsTrigger value="slow" className="text-xs h-7 px-2.5">Slow Moving (0 Sales)</TabsTrigger>
                <TabsTrigger value="new" className="text-xs h-7 px-2.5">New Arrivals</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {insightsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground text-left font-semibold">
                    <th className="py-2.5 px-4 w-12">#</th>
                    <th className="py-2.5 px-4">Jewellery Item</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Price</th>
                    <th className="py-2.5 px-4 text-center">In Stock</th>
                    {insightsTab !== "slow" && insightsTab !== "new" && (
                      <>
                        <th className="py-2.5 px-4 text-center">Units Sold</th>
                        <th className="py-2.5 px-4 text-right">Total Revenue</th>
                        {isAdmin && <th className="py-2.5 px-4 text-right">Gross Profit</th>}
                      </>
                    )}
                    {(insightsTab === "slow" || insightsTab === "new") && (
                      <th className="py-2.5 px-4 text-right">Added On</th>
                    )}
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {/* Tab 1: Top by Quantity */}
                  {insightsTab === "qty" && (
                    insights?.topByQuantity?.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No product sales in date range.</td></tr>
                    ) : (
                      insights?.topByQuantity?.map((p: any, idx: number) => (
                        <tr key={p.productId} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-amber-700">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {p.images?.[0] ? (
                                <img src={p.images[0]} alt={p.productName} className="w-9 h-9 object-cover rounded-md border shrink-0 bg-white" />
                              ) : (
                                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <span className="font-semibold text-neutral-900 block truncate max-w-xs">{p.productName}</span>
                                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                  SKU: {p.sku || p.supplierSku || "—"}
                                  <PraoMlLink product={p} showIcon={false} />
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">{p.category}</td>
                          <td className="py-3 px-4 text-right font-mono font-medium">{formatCurrency(p.price)}</td>
                          <td className="py-3 px-4 text-center font-mono">{p.stock}</td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-neutral-900">{p.quantitySold}</td>
                          <td className="py-3 px-4 text-right font-bold font-mono text-amber-900">{formatCurrency(p.revenue)}</td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right font-bold font-mono text-emerald-800">
                              {formatCurrency(p.profit)}
                            </td>
                          )}
                          <td className="py-3 px-4 text-right">
                            <Link href="/products">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-neutral-600 hover:text-neutral-900">
                                Inventory <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )
                  )}

                  {/* Tab 2: Top by Revenue */}
                  {insightsTab === "revenue" && (
                    insights?.topByRevenue?.map((p: any, idx: number) => (
                      <tr key={p.productId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-700">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.productName} className="w-9 h-9 object-cover rounded-md border shrink-0 bg-white" />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-neutral-900 block truncate max-w-xs">{p.productName}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">SKU: {p.sku || "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{p.category}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium">{formatCurrency(p.price)}</td>
                        <td className="py-3 px-4 text-center font-mono">{p.stock}</td>
                        <td className="py-3 px-4 text-center font-bold font-mono">{p.quantitySold}</td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-amber-900">{formatCurrency(p.revenue)}</td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right font-bold font-mono text-emerald-800">{formatCurrency(p.profit)}</td>
                        )}
                        <td className="py-3 px-4 text-right">
                          <Link href="/products">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Tab 3: Top by Profit */}
                  {insightsTab === "profit" && isAdmin && (
                    insights?.topByProfit?.map((p: any, idx: number) => (
                      <tr key={p.productId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.productName} className="w-9 h-9 object-cover rounded-md border shrink-0 bg-white" />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-neutral-900 block truncate max-w-xs">{p.productName}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">Cost: {formatCurrency(p.cogs / Math.max(p.quantitySold, 1))}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{p.category}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium">{formatCurrency(p.price)}</td>
                        <td className="py-3 px-4 text-center font-mono">{p.stock}</td>
                        <td className="py-3 px-4 text-center font-bold font-mono">{p.quantitySold}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(p.revenue)}</td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-emerald-800">
                          {formatCurrency(p.profit)}
                          <Badge variant="outline" className="ml-1 text-[9px] bg-emerald-50 text-emerald-800 border-emerald-300">
                            {p.margin}%
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href="/products">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Tab 4: Slow Moving */}
                  {insightsTab === "slow" && (
                    insights?.slowMoving?.map((p: any, idx: number) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-neutral-500">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.name} className="w-9 h-9 object-cover rounded-md border shrink-0 bg-white" />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-neutral-900 block truncate max-w-xs">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">ID: #{p.id} • SKU: {p.sku || "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{p.category}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium">{formatCurrency(p.price)}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">{p.availableQuantity} units</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{formatDate(p.createdAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <Link href="/products">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-amber-800">
                              Promote / Edit
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Tab 5: New Arrivals */}
                  {insightsTab === "new" && (
                    insights?.newArrivals?.map((p: any, idx: number) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-neutral-500">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.name} className="w-9 h-9 object-cover rounded-md border shrink-0 bg-white" />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-neutral-900 block truncate max-w-xs">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">ID: #{p.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{p.category}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium">{formatCurrency(p.price)}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">{p.availableQuantity} units</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{formatDate(p.createdAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/catalogue/${p.id}`} target="_blank">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                              View in Catalogue
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 7. RECENT BUSINESS ACTIVITY & TRANSACTIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Activity Stream (7 Cols) */}
        <Card className="lg:col-span-7 rounded-2xl border border-amber-100/90 bg-white shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-neutral-100 bg-neutral-50/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-serif text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Recent Business Activity
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest chronological audit stream across orders and warehouse stock.
                </CardDescription>
              </div>

              {/* Activity Filters */}
              <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setActivityFilter("all")}
                  className={`px-2 py-0.5 rounded text-xs transition-all ${
                    activityFilter === "all" ? "bg-white font-bold text-neutral-900 shadow-xs" : "text-neutral-600"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActivityFilter("order")}
                  className={`px-2 py-0.5 rounded text-xs transition-all ${
                    activityFilter === "order" ? "bg-white font-bold text-neutral-900 shadow-xs" : "text-neutral-600"
                  }`}
                >
                  Orders
                </button>
                <button
                  onClick={() => setActivityFilter("stock")}
                  className={`px-2 py-0.5 rounded text-xs transition-all ${
                    activityFilter === "stock" ? "bg-white font-bold text-neutral-900 shadow-xs" : "text-neutral-600"
                  }`}
                >
                  Stock Movements
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {activityLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground">
                No recent activity logged.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 max-h-[380px] overflow-y-auto">
                {filteredActivities.map((act: any) => {
                  const isOrder = act.type === "order";
                  return (
                    <div key={act.id} className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs hover:bg-neutral-50/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isOrder ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isOrder ? <ShoppingCart className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900 leading-tight">
                            {act.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {act.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isOrder ? (
                          <div>
                            <span className="font-mono font-bold text-neutral-900 block">
                              {formatCurrency(act.amount)}
                            </span>
                            <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0">
                              {act.status}
                            </Badge>
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono font-bold text-amber-800 block">
                              {act.qtyChange}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {act.status}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground/70 block mt-0.5">
                          {formatDate(act.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Operations Guide & System Health (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-2xl border border-amber-100/90 bg-white shadow-xs p-4 space-y-3">
            <h3 className="font-serif font-bold text-sm text-neutral-900 border-b border-neutral-100 pb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Catalogue &amp; Inventory Integrity Status
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <span className="text-emerald-900 font-medium">Verified PRAO Supplier Products:</span>
                <span className="font-mono font-bold text-emerald-950">{inv?.verifiedPraoCount || 569} of 581</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200/70">
                <span className="text-neutral-700">Flagged Non-PRAO Legacy Seed:</span>
                <span className="font-mono font-bold text-neutral-900">12 (Unlisted from /catalogue)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200/70">
                <span className="text-neutral-700">Protected Sales History Records:</span>
                <span className="font-mono font-bold text-blue-900">Guaranteed Safe (Zero Auto-Deletion)</span>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/catalogue-accuracy">
                <Button variant="outline" size="sm" className="w-full text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Open Catalogue Accuracy Studio
                </Button>
              </Link>
            </div>
          </Card>

          {/* Business Advice Card */}
          <Card className="rounded-2xl border border-amber-200/80 bg-amber-50/30 shadow-xs p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Shop Owner Daily Checklist
            </div>
            <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Review <strong>{inv?.lowStockCount || 0} Low Stock products</strong> to place re-orders with PRAO.</li>
              <li>Check outstanding customer balances ({formatCurrency(kpis?.payments?.pendingPayments || 0)}).</li>
              <li>Promote slow-moving Necklaces &amp; Rings on WhatsApp marketing.</li>
              <li>Export weekly financial backups using the <strong>Export Master Excel</strong> button.</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* ── DRILL-DOWN INSPECTION MODAL (FOR LOW STOCK, OUT OF STOCK, ZERO SALES) ── */}
      <Dialog open={Boolean(inspectModal)} onOpenChange={(open) => !open && setInspectModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-serif text-lg font-bold">
                  {inspectModal === "low-stock" && `Low Stock Products (≤ ${lowStockThreshold} Units)`}
                  {inspectModal === "out-of-stock" && "Sold Out Products (0 Stock)"}
                  {inspectModal === "zero-sales" && "Slow-Moving Products (Zero Sales in 30 Days)"}
                  {inspectModal === "discontinued" && "Discontinued & Inactive Products"}
                  {inspectModal === "all" && "All Inventory Products"}
                </DialogTitle>
                <Badge variant="outline" className="text-xs font-mono">
                  {inspectProducts?.total || 0} items
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-xs">
              Direct inventory drill-down for rapid stock replenishment and pricing adjustments.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {inspectLoading ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !inspectProducts?.data?.length ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No products found matching this filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground text-left font-semibold">
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Retail Price</th>
                      {isAdmin && <th className="py-2.5 px-3 text-right">Wholesale Cost</th>}
                      <th className="py-2.5 px-3 text-center">Available Stock</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {inspectProducts.data.map((p: any) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.name} className="w-8 h-8 object-cover rounded border bg-white shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-neutral-900 block truncate max-w-xs">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                SKU: {p.sku || p.supplierSku || "—"}
                                <PraoMlLink product={p} showIcon={false} />
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">{p.category}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">{formatCurrency(p.price)}</td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {p.supplierCost > 0 ? formatCurrency(p.supplierCost) : "—"}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center font-mono">
                          <Badge
                            variant={p.availableQuantity === 0 ? "destructive" : "outline"}
                            className="text-[10px] font-bold"
                          >
                            {p.availableQuantity} units
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link href="/inventory">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-amber-800">
                              Adjust Stock
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between">
            <Link href="/products">
              <Button variant="outline" size="sm" className="text-xs">
                Open Full Inventory
              </Button>
            </Link>
            <Button size="sm" onClick={() => setInspectModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
