import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Search,
  Filter,
  CheckSquare,
  Square,
  RefreshCw,
  ArrowRight,
  Eye,
  Edit2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface PreviewItem {
  sourceId: string;
  name: string;
  description: string;
  suggestedCategory: string;
  material: string;
  color: string;
  style: string;
  sku: string;
  supplierCost: number;
  retailPrice: number;
  compareAtPrice: number;
  initialStock: number;
  images: string[];
  primaryImage: string;
  isAlreadyImported: boolean;
}

export default function ImporterStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCollection, setSelectedCollection] = useState<string>("all");
  const [fetchLimit, setFetchLimit] = useState<string>("20");
  const [searchFilter, setSearchFilter] = useState<string>("");

  const [previewList, setPreviewList] = useState<PreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  // Fetch available collections
  const { data: collections = [] } = useQuery({
    queryKey: ["importer-collections"],
    queryFn: async () => {
      const res = await api.get("/api/importer/collections");
      return res.data;
    },
  });

  // Fetch standard categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/api/categories");
      return res.data;
    },
  });

  // Load preview items from supplier
  const handleFetchPreview = async () => {
    setIsFetchingPreview(true);
    try {
      const res = await api.get("/api/importer/preview", {
        params: {
          collection: selectedCollection,
          limit: fetchLimit,
        },
      });
      const items: PreviewItem[] = res.data.items || [];
      setPreviewList(items);

      // Pre-select non-imported items
      const newSelected = new Set<string>();
      items.forEach((item) => {
        if (!item.isAlreadyImported) newSelected.add(item.sourceId);
      });
      setSelectedIds(newSelected);

      toast({
        title: "Fetched Successfully",
        description: `Retrieved ${items.length} products. Brand titles and descriptions have been automatically sanitized.`,
      });
    } catch (err: any) {
      toast({
        title: "Fetch Failed",
        description: err.response?.data?.error || err.message || "Failed to load supplier catalog",
        variant: "destructive",
      });
    } finally {
      setIsFetchingPreview(false);
    }
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    previewList.forEach((item) => {
      if (!item.isAlreadyImported) all.add(item.sourceId);
    });
    setSelectedIds(all);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Update item field in local preview
  const updateItem = (sourceId: string, field: keyof PreviewItem, value: any) => {
    setPreviewList((prev) =>
      prev.map((item) => (item.sourceId === sourceId ? { ...item, [field]: value } : item))
    );
  };

  // Bulk import mutation
  const importMutation = useMutation({
    mutationFn: async (itemsToImport: PreviewItem[]) => {
      const payload = {
        products: itemsToImport.map((item) => ({
          sourceId: item.sourceId,
          name: item.name,
          description: item.description,
          category: item.suggestedCategory,
          material: item.material,
          color: item.color,
          style: item.style,
          sku: item.sku,
          retailPrice: item.retailPrice,
          compareAtPrice: item.compareAtPrice,
          supplierCost: item.supplierCost,
          stock: item.initialStock,
          images: item.images,
        })),
      };
      const res = await api.post("/api/importer/import", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Import Complete! 🎉",
        description: `${data.importedCount} products added to your private inventory.`,
      });
      queryClient.invalidateQueries({ queryKey: ["catalogue-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });

      // Mark imported items as imported in UI
      setPreviewList((prev) =>
        prev.map((item) =>
          selectedIds.has(item.sourceId) ? { ...item, isAlreadyImported: true } : item
        )
      );
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast({
        title: "Import Error",
        description: err.response?.data?.error || "Failed to import selected items",
        variant: "destructive",
      });
    },
  });

  const handleExecuteImport = () => {
    const chosen = previewList.filter((item) => selectedIds.has(item.sourceId));
    if (!chosen.length) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one product to import.",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(chosen);
  };

  const filteredPreview = previewList.filter((item) => {
    if (!searchFilter) return true;
    return (
      item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.suggestedCategory.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

  return (
    <AppLayout>
      <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Download className="w-5 h-5" />
              </span>
              <h1 className="font-serif text-2xl font-bold tracking-tight">
                Product Importer Studio
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Fetch, review, customize, and import jewellery collections into your private inventory.
              All supplier references and branding are scrubbed automatically.
            </p>
          </div>

          {previewList.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExecuteImport}
                disabled={importMutation.isPending || selectedIds.size === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-2 shadow-sm"
              >
                {importMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Import {selectedIds.size} Selected Products
              </Button>
            </div>
          )}
        </div>

        {/* Configuration Card */}
        <Card className="border-amber-200/60 bg-amber-50/20 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Step 1: Select Collection &amp; Fetch
            </CardTitle>
            <CardDescription className="text-xs">
              Select which catalogue collection you wish to inspect and review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Jewellery Collection
                </label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger className="bg-white dark:bg-neutral-900 border-neutral-300">
                    <SelectValue placeholder="All Anti-Tarnish Products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Anti-Tarnish Products (General)</SelectItem>
                    {collections.map((col: any) => (
                      <SelectItem key={col.id} value={col.handle}>
                        {col.title} ({col.productsCount} items)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Batch Size
                </label>
                <Select value={fetchLimit} onValueChange={setFetchLimit}>
                  <SelectTrigger className="bg-white dark:bg-neutral-900 border-neutral-300">
                    <SelectValue placeholder="20 Items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 Products</SelectItem>
                    <SelectItem value="20">20 Products</SelectItem>
                    <SelectItem value="35">35 Products</SelectItem>
                    <SelectItem value="50">50 Products (Max)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-3">
                <Button
                  onClick={handleFetchPreview}
                  disabled={isFetchingPreview}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold shadow-xs"
                >
                  {isFetchingPreview ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isFetchingPreview ? "Fetching..." : "Fetch & Preview"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview & Selection Table */}
        {previewList.length > 0 && (
          <div className="space-y-4">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-border shadow-xs">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  className="text-xs font-medium border-neutral-300"
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Select All New
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                  className="text-xs font-medium border-neutral-300"
                >
                  <Square className="w-3.5 h-3.5 mr-1" />
                  Deselect All
                </Button>
                <span className="text-xs text-muted-foreground ml-2">
                  {selectedIds.size} of {previewList.length} selected for import
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter preview list..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-border text-neutral-600 dark:text-neutral-300 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 w-10 text-center">Select</th>
                      <th className="p-3 w-16">Image</th>
                      <th className="p-3">Product Name (Sanitized)</th>
                      <th className="p-3 w-36">Category</th>
                      <th className="p-3 w-28">Supplier Cost</th>
                      <th className="p-3 w-32">Retail Price (₹)</th>
                      <th className="p-3 w-24">Initial Qty</th>
                      <th className="p-3 w-24 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPreview.map((item) => {
                      const isSelected = selectedIds.has(item.sourceId);
                      return (
                        <tr
                          key={item.sourceId}
                          className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors ${
                            item.isAlreadyImported ? "opacity-60 bg-neutral-50/40" : ""
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              disabled={item.isAlreadyImported}
                              checked={isSelected}
                              onChange={() => toggleSelect(item.sourceId)}
                              className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0">
                              <img
                                src={item.primaryImage}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={item.name}
                                disabled={item.isAlreadyImported}
                                onChange={(e) =>
                                  updateItem(item.sourceId, "name", e.target.value)
                                }
                                className="w-full font-medium text-xs bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-amber-500 focus:outline-hidden px-1 py-0.5"
                              />
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="font-mono">{item.sku}</span>
                                <span>•</span>
                                <span>{item.material}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <select
                              value={item.suggestedCategory}
                              disabled={item.isAlreadyImported}
                              onChange={(e) =>
                                updateItem(item.sourceId, "suggestedCategory", e.target.value)
                              }
                              className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 text-xs focus:ring-amber-500"
                            >
                              {categories.map((cat: any) => (
                                <option key={cat.id} value={cat.name}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 font-mono font-medium text-neutral-600">
                            ₹{item.supplierCost.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <span className="text-neutral-500">₹</span>
                              <input
                                type="number"
                                value={item.retailPrice}
                                disabled={item.isAlreadyImported}
                                onChange={(e) =>
                                  updateItem(
                                    item.sourceId,
                                    "retailPrice",
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-20 font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 text-xs focus:ring-amber-500"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={item.initialStock}
                              disabled={item.isAlreadyImported}
                              onChange={(e) =>
                                updateItem(
                                  item.sourceId,
                                  "initialStock",
                                  Number(e.target.value) || 0
                                )
                              }
                              className="w-16 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 text-xs text-center focus:ring-amber-500"
                            />
                          </td>
                          <td className="p-3 text-center">
                            {item.isAlreadyImported ? (
                              <Badge variant="outline" className="text-[10px] bg-neutral-100 text-neutral-600 border-neutral-300">
                                Imported
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">
                                Ready
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-xl border border-border shadow-xs">
              <span className="text-xs text-muted-foreground font-medium">
                {selectedIds.size} products ready to be added to SAJIRI JEWELS inventory.
              </span>
              <Button
                onClick={handleExecuteImport}
                disabled={importMutation.isPending || selectedIds.size === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-2 shadow-sm"
              >
                {importMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Import {selectedIds.size} Products Now
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
