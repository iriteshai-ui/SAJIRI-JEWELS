import { useState, useEffect } from "react";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
  getListInventoryQueryKey,
  type Product,
  type ProductInput,
  type ProductUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, Trash2, Package, ChevronsUpDown, Check, X, ChevronLeft, ChevronRight, Download, ShieldCheck, AlertTriangle, CheckCircle2, ExternalLink, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { DataTablePagination } from "@/components/common/data-table-pagination";
import { PraoMlLink, getMatchingPraoUrl } from "@/lib/prao-link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0.01, "Price must be greater than 0"),
  availableQuantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
});

type ProductForm = z.infer<typeof productSchema>;

export default function Products() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteProductObj, setDeleteProductObj] = useState<any | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<any | null>(null);
  const [verificationFilter, setVerificationFilter] = useState<string>("all");

  const { data, isLoading } = useListProducts(
    { search: search || undefined, page, limit: pageSize, verificationStatus: verificationFilter !== "all" ? verificationFilter : undefined } as any,
    { query: { queryKey: ["products", search || undefined, page, pageSize, verificationFilter] } }
  );

  const { data: allProductsData } = useListProducts(
    { limit: 100 },
    { query: { queryKey: getListProductsQueryKey({ limit: 100 }) } }
  );

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: 0, availableQuantity: 0 },
  });

  useEffect(() => {
    if (dialogOpen) {
      if (editProduct) {
        form.reset({
          name: editProduct.name,
          description: editProduct.description ?? "",
          price: editProduct.price,
          availableQuantity: editProduct.availableQuantity,
        });
      } else {
        form.reset({ name: "", description: "", price: 0, availableQuantity: 0 });
      }
    }
  }, [dialogOpen, editProduct]);

  const openCreate = () => {
    setEditProduct(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setDialogOpen(true);
  };

  const onSubmit = (values: ProductForm) => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
    };
    if (editProduct) {
      updateProduct.mutate(
        { id: editProduct.id, data: values as ProductUpdate },
        {
          onSuccess: () => { toast({ title: "Product updated" }); setDialogOpen(false); invalidate(); },
          onError: () => toast({ title: "Failed to update product", variant: "destructive" }),
        }
      );
    } else {
      createProduct.mutate(
        { data: values as ProductInput },
        {
          onSuccess: () => { toast({ title: "Product created" }); setDialogOpen(false); invalidate(); },
          onError: () => toast({ title: "Failed to create product", variant: "destructive" }),
        }
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteProduct.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Product deleted" });
          setDeleteId(null);
          setDeleteProductObj(null);
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        },
        onError: (err: any) => {
          toast({
            title: "Cannot Delete Product",
            description: err.response?.data?.error || "This product has sales history and cannot be deleted. Deactivate it instead.",
            variant: "destructive",
          });
          setDeleteId(null);
          setDeleteProductObj(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Jewellery Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage private product catalogue, stock levels, and pricing.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/catalogue-accuracy">
            <Button variant="outline" className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1.5 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Catalogue Accuracy
            </Button>
          </Link>
          <Link href="/importer">
            <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50 gap-1.5 font-semibold">
              <Download className="w-4 h-4" /> Import from Supplier
            </Button>
          </Link>
          <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold" data-testid="button-create-product">
            <Plus className="w-4 h-4 mr-1.5" /> Add Product
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Instant Search Bar */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            placeholder="Search jewellery by name, category, or SKU..."
            className="pl-9 pr-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            data-testid="input-search-products-instant"
          />
          {search && (
            <span
              onClick={() => { setSearch(""); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer z-10"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Verification Status Filter */}
        <Select
          value={verificationFilter}
          onValueChange={(val) => {
            setVerificationFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48 text-xs h-10">
            <SelectValue placeholder="Verification Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verification</SelectItem>
            <SelectItem value="verified">Verified PRAO Only</SelectItem>
            <SelectItem value="unverified">Unverified Non-PRAO</SelectItem>
            <SelectItem value="delisted">Delisted on Supplier</SelectItem>
          </SelectContent>
        </Select>

        {/* Quick Select Combobox Dropdown */}
        <Popover open={searchDropdownOpen} onOpenChange={setSearchDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={searchDropdownOpen}
              className="w-full sm:w-72 justify-between font-normal text-muted-foreground bg-background hover:bg-accent/50 shadow-xs h-10 px-3"
              data-testid="button-search-products-combobox"
            >
              <div className="flex items-center gap-2 truncate">
                <Package className="w-4 h-4 shrink-0 opacity-50 text-amber-600" />
                <span className={search ? "text-foreground font-medium truncate" : "truncate"}>
                  {search || "Select Jewellery Item..."}
                </span>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] sm:w-[380px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Auto-suggest jewellery item..." />
              <CommandList className="max-h-[260px] overflow-y-auto">
                <CommandEmpty>No matching jewellery items found.</CommandEmpty>
                <CommandGroup heading="All Jewellery Items">
                  {search && (
                    <CommandItem
                      value="--clear-all-search-filter--"
                      onSelect={() => {
                        setSearch("");
                        setPage(1);
                        setSearchDropdownOpen(false);
                      }}
                      className="text-xs text-primary font-semibold py-1.5 px-3 cursor-pointer border-b bg-muted/30"
                    >
                      Show All Products (Clear Search)
                    </CommandItem>
                  )}
                  {allProductsData?.data?.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.name}
                      onSelect={() => {
                        setSearch(p.name);
                        setPage(1);
                        setSearchDropdownOpen(false);
                      }}
                      className="flex items-center justify-between py-2 px-3 cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5 max-w-[200px]">
                        <span className="font-semibold text-sm text-foreground truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{p.description || (p as any).category || "Fashion Jewellery"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-primary">{formatCurrency(p.price)}</span>
                        <Badge variant={p.availableQuantity === 0 ? "destructive" : p.availableQuantity <= 2 ? "secondary" : "outline"} className="text-[10px]">
                          {p.availableQuantity} left
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Package className="w-12 h-12 opacity-30" />
              <p>No products found.</p>
              <Button variant="outline" onClick={openCreate}>Add your first product</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Source / Verification</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Stock</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Sales</th>
                  <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((p) => {
                  const hasSales = Number((p as any).orderCount || 0) > 0;
                  const isVerified = Boolean((p as any).isVerified);
                  const sourceUrl = (p as any).sourceUrl;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors text-xs" data-testid={`row-product-${p.id}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground text-sm">{p.name}</span>
                          <PraoMlLink product={p} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>ID: #{p.id}</span>
                          <span>•</span>
                          <span>SKU: {(p as any).sku || "—"}</span>
                          <span>•</span>
                          <span>{(p as any).category || "Jewellery"}</span>
                          <PraoMlLink product={p} showIcon={false} />
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          {isVerified ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] gap-1 font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified (PRAO)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1 font-semibold">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Unverified
                            </Badge>
                          )}
                          <PraoMlLink product={p} showIcon={true} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium font-mono text-sm">{formatCurrency(p.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={p.availableQuantity === 0 ? "destructive" : p.availableQuantity <= 2 ? "secondary" : "outline"} className="text-[10px]">
                          {p.availableQuantity === 0 ? "Out of stock" : `${p.availableQuantity} units`}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {hasSales ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                            {(p as any).orderCount} order(s)
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">0</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setViewProduct(p)} title="View Internal Details" data-testid={`button-view-product-${p.id}`}>
                            <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-product-${p.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={hasSales ? "opacity-30 cursor-not-allowed text-muted-foreground" : "text-destructive hover:text-destructive"}
                            disabled={hasSales}
                            onClick={() => {
                              if (!hasSales) {
                                setDeleteId(p.id);
                                setDeleteProductObj(p);
                              }
                            }}
                            title={hasSales ? `Protected sales record: Cannot delete (linked to ${(p as any).orderCount} orders)` : "Delete product"}
                            data-testid={`button-delete-product-${p.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {data && (
        <DataTablePagination
          currentPage={page}
          totalPages={Math.ceil(data.total / pageSize)}
          pageSize={pageSize}
          totalItems={data.total}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[25, 50, 100, 200]}
          itemLabel="jewellery products"
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditProduct(null); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>{editProduct ? `Edit Product #${editProduct.id}` : "Add Product"}</DialogTitle>
              {editProduct && <PraoMlLink product={editProduct} showIcon={true} className="text-xs" />}
            </div>
          </DialogHeader>
          {editProduct && (
            <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-lg p-2.5 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">SKU: {(editProduct as any).sku || "—"}</span>
                {(editProduct as any).supplierSku && (
                  <span className="text-amber-800 dark:text-amber-300 font-mono">PRAO: {(editProduct as any).supplierSku}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Supplier:</span>
                <PraoMlLink product={editProduct} showIcon={true} className="font-semibold text-xs" />
              </div>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-product-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea {...field} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₹)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="availableQuantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                  {editProduct ? "Save Changes" : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Internal Product Details Modal ── */}
      <Dialog open={!!viewProduct} onOpenChange={(open) => !open && setViewProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-serif text-lg font-bold">
                  Internal Product Details
                </DialogTitle>
                <span className="font-mono text-xs text-muted-foreground">
                  #{viewProduct?.id}
                </span>
                {viewProduct?.isVerified ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified PRAO
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1 font-semibold">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Unverified
                  </Badge>
                )}
              </div>
              <PraoMlLink product={viewProduct} showIcon={true} className="text-xs" />
            </div>
          </DialogHeader>

          {viewProduct && (
            <div className="space-y-4 text-xs mt-2">
              {/* Top Summary Card */}
              <div className="flex flex-col sm:flex-row gap-4 p-3 bg-muted/30 rounded-xl border">
                {viewProduct.images?.length > 0 ? (
                  <img
                    src={viewProduct.images[0]}
                    alt={viewProduct.name}
                    className="w-24 h-24 object-cover rounded-lg border bg-white shrink-0 mx-auto sm:mx-0"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                    <Package className="w-8 h-8 opacity-40" />
                  </div>
                )}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground leading-tight">
                      {viewProduct.name}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>Category: <strong className="text-foreground">{viewProduct.category || "Jewellery"}</strong></span>
                    {viewProduct.subcategory && <span>• Subcategory: <strong className="text-foreground">{viewProduct.subcategory}</strong></span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="font-mono">
                      <span className="text-muted-foreground text-[11px] block">Selling Price</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(viewProduct.price)}</span>
                    </div>
                    {viewProduct.compareAtPrice > 0 && (
                      <div className="font-mono">
                        <span className="text-muted-foreground text-[11px] block">Compare Price</span>
                        <span className="text-xs line-through text-muted-foreground">{formatCurrency(viewProduct.compareAtPrice)}</span>
                      </div>
                    )}
                    <div className="font-mono">
                      <span className="text-muted-foreground text-[11px] block">Stock Available</span>
                      <span className="text-xs font-semibold">{viewProduct.availableQuantity} units</span>
                    </div>
                    <div className="font-mono">
                      <span className="text-muted-foreground text-[11px] block">Sales Orders</span>
                      <span className="text-xs font-semibold">{viewProduct.orderCount || 0} order(s)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Private PRAO Matching & Supplier Integrity Section */}
              <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <span className="font-semibold text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Supplier Source &amp; Private Matching Record
                  </span>
                  <PraoMlLink product={viewProduct} showIcon={true} className="font-bold text-xs" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Supplier SKU</span>
                    <span className="font-mono font-medium text-foreground">
                      {viewProduct.supplierSku || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Shopify Supplier Product ID</span>
                    <span className="font-mono font-medium text-foreground">
                      {viewProduct.supplierProductId || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Internal Store SKU</span>
                    <span className="font-mono font-medium text-foreground">
                      {viewProduct.sku || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Supplier Cost</span>
                    <span className="font-mono font-medium text-foreground">
                      {viewProduct.supplierCost ? formatCurrency(viewProduct.supplierCost) : "—"}
                    </span>
                  </div>
                </div>

                {/* Direct Private PRAO URL with discreet ML indicator */}
                <div className="pt-2 border-t border-amber-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                      Private Matching Link:
                    </span>
                    <PraoMlLink product={viewProduct} showIcon={true} className="text-xs font-semibold" />
                  </div>
                  {getMatchingPraoUrl(viewProduct) ? (
                    <a
                      href={getMatchingPraoUrl(viewProduct)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white underline decoration-dotted truncate max-w-sm"
                      title="Open matching original PRAO product page in a new tab"
                    >
                      <span className="truncate">{getMatchingPraoUrl(viewProduct)}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">
                      No matching original PRAO record mapped
                    </span>
                  )}
                </div>

                {viewProduct.verificationNotes && (
                  <div className="text-[11px] text-muted-foreground pt-1">
                    Verification Note: {viewProduct.verificationNotes}
                  </div>
                )}
              </div>

              {/* Physical Jewellery Specifications */}
              <div className="p-3 bg-muted/20 border rounded-xl space-y-2">
                <span className="font-semibold text-xs text-foreground uppercase tracking-wider block border-b pb-1.5">
                  Jewellery Specifications
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Material</span>
                    <span className="font-medium text-foreground">{viewProduct.material || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Color / Finish</span>
                    <span className="font-medium text-foreground">{viewProduct.color || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Style</span>
                    <span className="font-medium text-foreground">{viewProduct.style || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Design</span>
                    <span className="font-medium text-foreground">{viewProduct.design || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {viewProduct.description && (
                <div className="p-3 bg-muted/10 border rounded-xl space-y-1">
                  <span className="font-semibold text-xs text-foreground block">
                    Product Description
                  </span>
                  <p className="text-muted-foreground text-xs leading-relaxed line-clamp-4">
                    {viewProduct.description}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-2">
              {viewProduct?.isVerified && (
                <Link href={`/catalogue/${viewProduct.id}`} target="_blank">
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Customer Page
                  </Button>
                </Link>
              )}
              {getMatchingPraoUrl(viewProduct) && (
                <a
                  href={getMatchingPraoUrl(viewProduct)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50 gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open PRAO (ML)
                  </Button>
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewProduct(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  const p = viewProduct;
                  setViewProduct(null);
                  openEdit(p);
                }}
              >
                <Edit className="w-3.5 h-3.5 mr-1" />
                Edit Product
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteProductObj(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Product
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>Are you sure you want to permanently delete this product?</p>
              {deleteProductObj && (
                <div className="p-2.5 bg-muted rounded font-medium text-foreground">
                  #{deleteProductObj.id} — {deleteProductObj.name} ({formatCurrency(deleteProductObj.price)})
                </div>
              )}
              <p className="text-muted-foreground">
                This item has <strong>0 customer order references</strong>. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
