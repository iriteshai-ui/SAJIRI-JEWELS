import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import api from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  EyeOff,
  Eye,
  RefreshCw,
  ExternalLink,
  Layers,
  Copy,
  FileText,
  Sparkles,
  ArrowRight,
  Info,
  Package,
  HelpCircle,
  Gem,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PraoMlLink } from "@/lib/prao-link";

export default function CatalogueAccuracyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("unverified");

  // State for Safe Deletion Modal
  const [deleteProduct, setDeleteProduct] = useState<any | null>(null);

  // State for Manual Verification Modal
  const [verifyProduct, setVerifyProduct] = useState<any | null>(null);
  const [manualSourceUrl, setManualSourceUrl] = useState<string>("");
  const [manualNotes, setManualNotes] = useState<string>("");

  // Fetch Catalogue Audit Report
  const { data: auditData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["catalogue-audit"],
    queryFn: async () => {
      const res = await api.get("/api/admin/catalogue-audit");
      return res.data;
    },
  });

  // Mutation: Run Verification
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/api/admin/verify-catalogue");
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["catalogue-audit"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalogue-products"] });
      toast({
        title: "Catalogue Verification Complete",
        description: data.message || `Verified ${data.verifiedCount} PRAO products.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: err.response?.data?.error || err.message || "Failed to verify catalogue",
      });
    },
  });

  // Mutation: Deactivate All Unverified Products
  const deactivateUnverifiedMutation = useMutation({
    mutationFn: async (productIds?: number[]) => {
      const res = await api.post("/api/admin/cleanup/deactivate-unverified", { productIds });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["catalogue-audit"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalogue-products"] });
      toast({
        title: "Deactivation Complete",
        description: data.message || "Unverified products have been safely deactivated.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: err.response?.data?.error || err.message || "Failed to deactivate products",
      });
    },
  });

  // Mutation: Differentiate Duplicate Names
  const differentiateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/api/admin/cleanup/differentiate-duplicates");
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["catalogue-audit"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalogue-products"] });
      toast({
        title: "Duplicates Differentiated",
        description: data.message || `Updated ${data.updatedCount} duplicate product titles.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: err.response?.data?.error || err.message || "Failed to differentiate duplicates",
      });
    },
  });

  // Mutation: Deactivate Single Duplicate
  const deactivateSingleMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await api.post("/api/admin/cleanup/deactivate-duplicate", { productId });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["catalogue-audit"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalogue-products"] });
      toast({
        title: "Product Deactivated",
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: err.response?.data?.error || err.message,
      });
    },
  });

  // Mutation: Safe Delete Single Product
  const safeDeleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await api.delete(`/api/admin/cleanup/product/${productId}`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["catalogue-audit"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalogue-products"] });
      setDeleteProduct(null);
      toast({
        title: "Product Safely Removed",
        description: (data as any)?.message || "Product removed successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Cannot Delete Record",
        description: err.response?.data?.error || err.message || "Delete operation rejected to protect sales history.",
      });
    },
  });

  // Mutation: Manual Verification Update
  const manualVerifyMutation = useMutation({
    mutationFn: async ({ id, isVerified, sourceUrl, notes }: { id: number; isVerified: boolean; sourceUrl: string; notes: string }) => {
      const res = await api.post(`/api/admin/products/${id}/verify`, {
        isVerified,
        verificationStatus: isVerified ? "verified" : "unverified",
        sourceUrl,
        notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue-audit"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalogue-products"] });
      setVerifyProduct(null);
      toast({
        title: "Verification Updated",
        description: "Product verification status successfully modified.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.response?.data?.error || err.message,
      });
    },
  });

  const summary = auditData?.summary || {
    totalProducts: 0,
    verifiedProducts: 0,
    delistedProducts: 0,
    unverifiedProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    duplicateGroupsCount: 0,
    totalDuplicateProducts: 0,
    productsWithSalesHistory: 0,
    totalOrderLineItems: 0,
  };

  const unverifiedList: any[] = auditData?.unverifiedList || [];
  const duplicateGroups: any[] = auditData?.duplicateGroups || [];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header & Title ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-widest font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Admin Inventory Tool
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Live DB Synced
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            Catalogue Accuracy &amp; Integrity Studio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verify products against PRAO supplier records, flag unverified items, resolve duplicates, and ensure non-PRAO products never leak into /catalogue.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh Audit
          </Button>
          <Button
            size="sm"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            {verifyMutation.isPending ? "Verifying Catalogue..." : "Run PRAO Verification"}
          </Button>
        </div>
      </div>

      {/* ── Strict Sales History Protection Guarantee Banner ── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-blue-950 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-sm text-blue-900">
            Automatic Record Protection: Sales History &amp; Orders Are Guaranteed Safe
          </p>
          <p className="text-blue-800 leading-relaxed">
            Per strict inventory integrity policies, the system <strong>never automatically deletes any existing records or sales history</strong>. Products linked to past customer invoices ({summary.productsWithSalesHistory} products across {summary.totalOrderLineItems} order items) cannot be deleted. Any cleanup operations allow safe soft-deactivation to hide items from active catalogues while preserving all financial and transaction audit logs.
          </p>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Verified PRAO Products */}
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                Verified PRAO Items
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-serif text-emerald-950">
                {summary.verifiedProducts}
              </span>
              <span className="text-xs text-emerald-700 font-medium">
                in /catalogue
              </span>
            </div>
            <p className="text-[11px] text-emerald-700/80 mt-1">
              Verified with PRAO source product ID &amp; URL
            </p>
          </CardContent>
        </Card>

        {/* Unverified Non-PRAO Products */}
        <Card className="border-amber-200 bg-amber-50/40 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Unverified Non-PRAO
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-serif text-amber-950">
                {summary.unverifiedProducts}
              </span>
              <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                Flagged
              </Badge>
            </div>
            <p className="text-[11px] text-amber-700/80 mt-1">
              Hidden from public fashion catalogue
            </p>
          </CardContent>
        </Card>

        {/* Duplicate Groups */}
        <Card className="border-purple-200 bg-purple-50/40 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
                Duplicate Groups
              </span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-serif text-purple-950">
                {summary.duplicateGroupsCount}
              </span>
              <span className="text-xs text-purple-700 font-medium">
                ({summary.totalDuplicateProducts} items)
              </span>
            </div>
            <p className="text-[11px] text-purple-700/80 mt-1">
              Identical titles from supplier imports
            </p>
          </CardContent>
        </Card>

        {/* Sales History Protected */}
        <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                Sales History Intact
              </span>
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-serif text-blue-950">
                {summary.productsWithSalesHistory}
              </span>
              <span className="text-xs text-blue-700 font-medium">
                linked products
              </span>
            </div>
            <p className="text-[11px] text-blue-700/80 mt-1">
              {summary.totalOrderLineItems} customer invoice order lines
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs: Unverified Products vs Duplicates vs Audit Details ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1 border">
          <TabsTrigger value="unverified" className="gap-2 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Unverified Non-PRAO Items ({unverifiedList.length})
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-2 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            Duplicate Groups ({duplicateGroups.length})
          </TabsTrigger>
          <TabsTrigger value="explanation" className="gap-2 text-xs font-semibold">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            Root Cause &amp; Architecture
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: UNVERIFIED PRODUCTS ── */}
        <TabsContent value="unverified" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-serif">
                    Unverified / Non-PRAO Inventory Items ({unverifiedList.length})
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    These items lack a PRAO supplier product ID and source URL. They originated from legacy jewellery seed data.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deactivateUnverifiedMutation.mutate(undefined)}
                    disabled={deactivateUnverifiedMutation.isPending || unverifiedList.filter(p => p.isActive).length === 0}
                    className="text-xs text-amber-800 border-amber-300 hover:bg-amber-50 gap-1.5"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    Deactivate All ({unverifiedList.filter(p => p.isActive).length} Active)
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Loading unverified products...
                </div>
              ) : unverifiedList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-foreground">Zero Unverified Products</p>
                  <p className="text-xs max-w-md mx-auto">
                    All items in the database are verified PRAO products with valid source product IDs and URLs.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 font-semibold text-muted-foreground text-left">
                        <th className="py-2.5 px-4 w-14">ID</th>
                        <th className="py-2.5 px-4">Product Name</th>
                        <th className="py-2.5 px-4">Category / Metal</th>
                        <th className="py-2.5 px-4 text-right">Price</th>
                        <th className="py-2.5 px-4 text-center">Stock</th>
                        <th className="py-2.5 px-4 text-center">Sales History</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {unverifiedList.map((p) => {
                        const hasSales = Number(p.orderCount || 0) > 0;
                        return (
                          <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-muted-foreground">
                              #{p.id}
                            </td>
                            <td className="py-3 px-4 max-w-[280px]">
                              <div className="font-semibold text-foreground truncate">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {p.verificationNotes || "Missing PRAO supplier source"}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium">{p.category}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {p.metalType} • {p.purity}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                              {formatCurrency(p.price)}
                            </td>
                            <td className="py-3 px-4 text-center font-medium">
                              {p.availableQuantity} units
                            </td>
                            <td className="py-3 px-4 text-center">
                              {hasSales ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] gap-1">
                                  <FileText className="w-3 h-3" />
                                  {p.orderCount} Order(s)
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/70 text-[11px]">
                                  0 Orders
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {p.isActive ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] border-emerald-300">
                                  Active (Unlisted from /catalogue)
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Deactivated
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Toggle Active / Deactivate */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deactivateSingleMutation.mutate(p.id)}
                                  disabled={!p.isActive}
                                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                  title={p.isActive ? "Deactivate to hide" : "Already Deactivated"}
                                >
                                  <EyeOff className="w-3.5 h-3.5 mr-1" />
                                  Deactivate
                                </Button>

                                {/* Manual Verification */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setVerifyProduct(p);
                                    setManualSourceUrl(p.sourceUrl || "");
                                    setManualNotes(p.verificationNotes || "");
                                  }}
                                  className="h-7 px-2 text-[11px] text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                                >
                                  Verify
                                </Button>

                                {/* Safe Delete (only if 0 orders) */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteProduct(p)}
                                  disabled={hasSales}
                                  className={`h-7 px-2 text-[11px] ${
                                    hasSales
                                      ? "opacity-30 cursor-not-allowed text-muted-foreground"
                                      : "text-destructive hover:bg-destructive/10"
                                  }`}
                                  title={hasSales ? "Cannot delete: Protected sales history exists" : "Safe to delete (0 orders)"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: DUPLICATE GROUPS ── */}
        <TabsContent value="duplicates" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-serif">
                    Duplicate Name Groups ({duplicateGroups.length} Groups, {summary.totalDuplicateProducts} Items)
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    These items share identical names but possess different PRAO supplier SKUs and Shopify IDs.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => differentiateMutation.mutate()}
                    disabled={differentiateMutation.isPending}
                    className="bg-purple-700 hover:bg-purple-800 text-white text-xs gap-1.5 shadow-sm"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Auto-Differentiate Names with SKU
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {duplicateGroups.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-foreground">Zero Duplicate Product Names</p>
                  <p className="text-xs max-w-md mx-auto">
                    All product titles across the catalogue are distinct and unique.
                  </p>
                </div>
              ) : (
                duplicateGroups.map((group: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-purple-200/80 bg-purple-50/20 overflow-hidden shadow-xs"
                  >
                    <div className="bg-purple-100/60 px-4 py-2.5 flex items-center justify-between border-b border-purple-200">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs font-mono bg-purple-200 text-purple-900 px-2 py-0.5 rounded">
                          Group #{idx + 1}
                        </span>
                        <span className="font-semibold text-xs text-purple-950">
                          {group.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-white border-purple-300 text-purple-800">
                          {group.count} Variants
                        </Badge>
                      </div>
                    </div>

                    <div className="divide-y divide-purple-100 bg-white">
                      {group.products.map((p: any) => {
                        const hasSales = Number(p.orderCount || 0) > 0;
                        const firstImage = Array.isArray(p.images) ? p.images[0] : null;
                        return (
                          <div
                            key={p.id}
                            className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-neutral-50/80 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {firstImage ? (
                                <img
                                  src={firstImage}
                                  alt={p.name}
                                  className="w-10 h-10 object-cover rounded-md border border-border shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-muted-foreground font-semibold">
                                    ID: #{p.id}
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {p.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                  <span>Supplier SKU: <strong className="text-foreground">{p.supplierSku || "—"}</strong></span>
                                  <span>•</span>
                                  <span>PRAO ID: <code className="font-mono">{p.supplierProductId || "—"}</code></span>
                                  <PraoMlLink product={p} showIcon={false} />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <div className="text-right">
                                <div className="font-bold font-mono text-foreground">
                                  {formatCurrency(p.price)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {p.availableQuantity} in stock
                                </div>
                              </div>

                              <div>
                                {hasSales ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                    {p.orderCount} Order(s)
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    0 Orders
                                  </Badge>
                                )}
                              </div>

                              <div>
                                {p.isActive ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Deactivated
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <PraoMlLink product={p} showIcon={true} />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deactivateSingleMutation.mutate(p.id)}
                                  disabled={!p.isActive}
                                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                  title="Deactivate duplicate to avoid confusion"
                                >
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  Deactivate
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: ROOT CAUSE & ARCHITECTURAL SUMMARY ── */}
        <TabsContent value="explanation" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg font-serif">
                Investigation &amp; Technical Root Cause
              </CardTitle>
              <CardDescription className="text-xs">
                Detailed documentation of why non-PRAO items appeared and how catalogue accuracy is strictly guaranteed.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6 text-sm leading-relaxed text-foreground/90">
              <div className="space-y-2">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-xs flex items-center justify-center font-bold">1</span>
                  Why did non-PRAO products appear in /catalogue?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                  During early platform setup, the database was populated with sample seed inventory items (IDs 1 to 12) representing high-value traditional Indian gold and diamond jewellery (such as <em>SAJRI 22K Antique Royal Bridal Necklace</em> with prices up to ₹3,41,600). When the PRAO importer script was run, it executed a blanket SQL rename that prepended <code>SAJRI</code> to all existing records. Concurrently, the customer-facing <code>/api/catalogue/products</code> query only filtered for <code>isActive = true</code> without verifying if the item was a genuine PRAO fashion jewellery product. Consequently, those 12 non-PRAO traditional items appeared in the fashion catalogue.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-bold">2</span>
                  How verification by source product ID and URL works
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                  PRAO products imported from Shopify have a unique <code>supplier_product_id</code> (e.g., <code>10426213171489</code>) and <code>supplier_sku</code> (e.g., <code>5749PR</code>). Migration <code>003_add_product_verification.sql</code> added dedicated tracking columns: <code>is_verified</code>, <code>source_url</code>, <code>verification_status</code>, and <code>verified_at</code>. Each verified item is linked to its canonical PRAO web page (<code>https://prao.com/products/&#123;sku&#125;</code>). The public <code>/api/catalogue/products</code> endpoint now strictly filters by <code>is_verified = true</code>, guaranteeing that only genuine, verified anti-tarnish fashion jewellery is accessible to public shoppers.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-xs flex items-center justify-center font-bold">3</span>
                  How duplicate titles are identified and handled
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                  16 duplicate title groups were identified (e.g., <em>SAJRI Bracelet Anti-Tarnish Gold Plated Bangle (Adjustable Size)</em>). These were created because the supplier PRAO listed several design variations under the same generic title on Shopify. The Studio provides an automated <strong>Auto-Differentiate Names</strong> action that appends the unique supplier SKU to each title, allowing staff to distinguish them during billing without losing any records.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">4</span>
                  Sales History &amp; Zero Automatic Deletion Policy
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                  In compliance with the strict mandate to <strong>never delete sales history or existing records automatically</strong>, cleanup operations default to soft-deactivation. Even when an administrator clicks delete, the API enforces a server-side foreign key and reference check: if any order line items exist in <code>order_items</code>, the deletion request is rejected with HTTP 400. All historical invoices, audit trails, and financial records remain permanently intact.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Safe Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Product (Safe Cleanup)
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                Are you sure you want to permanently delete product:
              </p>
              <div className="p-2.5 bg-muted rounded-md font-medium text-foreground">
                #{deleteProduct?.id} — {deleteProduct?.name} ({formatCurrency(deleteProduct?.price)})
              </div>
              <p className="text-muted-foreground">
                This product has <strong>0 customer order references</strong>, so deleting it will not affect any sales history or invoice records.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProduct && safeDeleteMutation.mutate(deleteProduct.id)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Confirm Safe Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Manual Verification Dialog ── */}
      <Dialog open={!!verifyProduct} onOpenChange={() => setVerifyProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Manual Product Verification</DialogTitle>
            <DialogDescription className="text-xs">
              Set or update source URL and verification notes for #{verifyProduct?.id}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold block mb-1">Product</label>
              <p className="text-muted-foreground font-medium">{verifyProduct?.name}</p>
            </div>

            <div>
              <label className="font-semibold block mb-1">Supplier Source URL</label>
              <Input
                type="url"
                placeholder="https://prao.com/products/..."
                value={manualSourceUrl}
                onChange={(e) => setManualSourceUrl(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Verification Notes</label>
              <Textarea
                placeholder="e.g. Manually verified from supplier invoice..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setVerifyProduct(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (verifyProduct) {
                  manualVerifyMutation.mutate({
                    id: verifyProduct.id,
                    isVerified: true,
                    sourceUrl: manualSourceUrl,
                    notes: manualNotes,
                  });
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              Mark Verified
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

