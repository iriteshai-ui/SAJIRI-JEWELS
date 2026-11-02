import { useState } from "react";
import {
  useListProducts,
  getListOrdersQueryKey,
  getListProductsQueryKey,
  type Order,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  ShoppingCart,
  Check,
  Printer,
  Download,
  Eye,
  Edit3,
  CheckCircle2,
  Calendar,
  Sparkles,
  Search,
  CreditCard,
  Phone,
  User,
  MapPin,
  FileText,
  Gem,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderLineItem {
  productId: number;
  productName: string;
  image?: string;
  category?: string;
  price: number;
  quantity: number;
  availableQuantity: number;
}

export default function NewOrder() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Customer state
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPan, setCustomerPan] = useState("");
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Billing state - Jewellery standard GST in India is 3%
  const [gstPercentage, setGstPercentage] = useState(3);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [customPaidAmount, setCustomPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");

  // Items in bill
  const [items, setItems] = useState<OrderLineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [searchProductQuery, setSearchProductQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation screen state
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch all available jewellery products
  const { data: productsData, isLoading: isLoadingProducts } = useListProducts(
    { limit: 150 },
    { query: { queryKey: getListProductsQueryKey({ limit: 150 }) } }
  );

  const allProducts = productsData?.data || [];
  const inStockProducts = allProducts.filter((p: any) => p.availableQuantity > 0);

  // Filtered by search query
  const filteredProducts = inStockProducts.filter((p: any) => {
    if (!searchProductQuery.trim()) return true;
    const q = searchProductQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  const selectedProduct = allProducts.find((p: any) => p.id === selectedProductId);

  // Add currently selected product or a specified product to the bill
  const handleAddProduct = (prodToAdd?: any, qtyToAdd?: number) => {
    const targetProduct = prodToAdd || selectedProduct;
    const qty = qtyToAdd !== undefined ? qtyToAdd : itemQuantity;

    if (!targetProduct) {
      toast({
        title: "Please choose a jewellery item",
        description: "Select an item from the dropdown or click Add on any product.",
        variant: "destructive",
      });
      return;
    }

    if (qty < 1) {
      toast({ title: "Quantity must be at least 1", variant: "destructive" });
      return;
    }

    const existingIdx = items.findIndex((i) => i.productId === targetProduct.id);
    const newTotalQty = existingIdx >= 0 ? items[existingIdx].quantity + qty : qty;

    if (newTotalQty > targetProduct.availableQuantity) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${targetProduct.availableQuantity} units available for ${targetProduct.name}`,
        variant: "destructive",
      });
      return;
    }

    const firstImage = Array.isArray(targetProduct.images) && targetProduct.images.length > 0
      ? targetProduct.images[0]
      : targetProduct.image;

    if (existingIdx >= 0) {
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: newTotalQty } : item
        )
      );
      toast({
        title: "Quantity Updated",
        description: `Increased ${targetProduct.name} to ${newTotalQty} units.`,
      });
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: targetProduct.id,
          productName: targetProduct.name,
          category: targetProduct.category,
          image: firstImage,
          price: Number(targetProduct.price),
          quantity: qty,
          availableQuantity: targetProduct.availableQuantity,
        },
      ]);
      toast({
        title: "Item Added",
        description: `${targetProduct.name} added to bill.`,
      });
    }

    setSelectedProductId(null);
    setItemQuantity(1);
    setSearchProductQuery("");
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        if (newQty > item.availableQuantity) {
          toast({
            title: `Only ${item.availableQuantity} units available`,
            variant: "destructive",
          });
          return item;
        }
        return { ...item, quantity: newQty };
      })
    );
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerMobile("");
    setCustomerEmail("");
    setCustomerAddress("");
    setCustomerPan("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setGstPercentage(3);
    setDiscountPercentage(0);
    setCustomPaidAmount("");
    setPaymentMethod("Cash");
    setItems([]);
    setSelectedProductId(null);
    setItemQuantity(1);
    setCreatedOrder(null);
  };

  // Calculations
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = (subtotal * discountPercentage) / 100;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const gstAmount = subtotalAfterDiscount * (gstPercentage / 100);
  const grandTotal = Math.round(subtotalAfterDiscount + gstAmount);

  // Clean and normalize mobile number
  const cleanMobile = customerMobile.replace(/[\s\-\(\)\+]/g, "");
  let normalizedMobile = cleanMobile;
  if (normalizedMobile.startsWith("91") && normalizedMobile.length === 12) {
    normalizedMobile = normalizedMobile.slice(2);
  } else if (normalizedMobile.startsWith("0") && normalizedMobile.length === 11) {
    normalizedMobile = normalizedMobile.slice(1);
  }

  const handleSubmit = async (andPrint = false) => {
    if (!customerName.trim()) {
      toast({ title: "Please enter customer name", variant: "destructive" });
      return;
    }

    if (!normalizedMobile.trim()) {
      toast({ title: "Please enter customer mobile number", variant: "destructive" });
      return;
    }

    if (normalizedMobile.length < 10) {
      toast({
        title: "Invalid Mobile Number",
        description: "Mobile number must contain at least 10 digits.",
        variant: "destructive",
      });
      return;
    }

    // Auto-add safety net: if items list is empty but a product is selected in dropdown, add it!
    let finalItems = [...items];
    if (finalItems.length === 0 && selectedProduct) {
      finalItems = [
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          category: selectedProduct.category,
          price: Number(selectedProduct.price),
          quantity: itemQuantity,
          availableQuantity: selectedProduct.availableQuantity,
        },
      ];
      setItems(finalItems);
    }

    if (finalItems.length === 0) {
      toast({
        title: "Invoice is empty",
        description: "Please select and add at least one jewellery product to create an order.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customerName: customerName.trim(),
        customerMobile: normalizedMobile.slice(-10),
        customerEmail: customerEmail.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        customerPan: customerPan.trim().toUpperCase() || undefined,
        gstPercentage,
        discount: discountAmount,
        paidAmount: customPaidAmount !== "" ? Number(customPaidAmount) : grandTotal,
        paymentMethod,
        createdAt: orderDate ? `${orderDate}T12:00:00.000Z` : undefined,
        items: finalItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.price,
        })),
      };

      const res = await api.post("/api/orders", payload);
      const order = res.data;

      toast({
        title: "Order Created Successfully!",
        description: `Invoice ${order.invoiceNumber} has been generated.`,
      });

      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setCreatedOrder(order);

      if (andPrint) {
        try {
          const invoiceRes = await fetch(`/api/orders/${order.id}/invoice`, { credentials: "include" });
          if (invoiceRes.ok) {
            const blob = await invoiceRes.blob();
            const url = URL.createObjectURL(blob);
            const printWin = window.open(url, "_blank");
            if (printWin) printWin.focus();
          }
        } catch (e) {
          console.error("Failed to open print invoice:", e);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Failed to create order";
      toast({
        title: "Order Creation Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = async (orderId: number) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWin = window.open(url, "_blank");
      if (printWin) printWin.focus();
    } catch {
      toast({ title: "Failed to open print window", variant: "destructive" });
    }
  };

  const handleDownload = async (orderId: number, invoiceNumber: string) => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Failed to download invoice", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // If order was created, render the Order Confirmation & Summary Screen
  if (createdOrder) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto py-4">
        <Card className="border-primary/30 bg-gradient-to-b from-card to-primary/[0.03] shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3 ring-4 ring-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs font-serif uppercase tracking-widest text-primary mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Rits Jewellers</span>
            </div>
            <CardTitle className="text-2xl font-serif font-bold text-foreground">
              Order Created & Invoice Generated!
            </CardTitle>
            <p className="text-primary font-mono font-bold text-base mt-1">{createdOrder.invoiceNumber}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-muted/40 p-5 rounded-xl border border-border">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Customer Details</p>
                <p className="font-bold text-base mt-1 text-foreground">{createdOrder.customerName}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">📞 {createdOrder.customerMobile}</p>
                {createdOrder.customerEmail && (
                  <p className="text-xs text-muted-foreground mt-0.5">✉️ {createdOrder.customerEmail}</p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total & Payment</p>
                <p className="font-extrabold text-2xl text-primary font-serif mt-1">
                  {formatCurrency(createdOrder.grandTotal)}
                </p>
                <div className="mt-2 flex sm:justify-end gap-2">
                  <Badge
                    variant={createdOrder.pendingAmount > 0 ? "outline" : "default"}
                    className={
                      createdOrder.pendingAmount > 0
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "bg-emerald-600 text-white"
                    }
                  >
                    {createdOrder.pendingAmount > 0
                      ? `Balance Pending: ${formatCurrency(createdOrder.pendingAmount)}`
                      : "Paid in Full"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {createdOrder.paymentMethod}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                className="border-primary/40 text-primary font-bold hover:bg-primary/5 cursor-pointer"
                onClick={() => setCreatedOrder(null)}
              >
                <Edit3 className="w-4 h-4 mr-2" /> Edit Current Order
              </Button>

              <Button
                variant="outline"
                className="font-bold cursor-pointer"
                onClick={() => handlePrint(createdOrder.id)}
              >
                <Printer className="w-4 h-4 mr-2" /> Print Invoice
              </Button>

              <Button
                variant="outline"
                disabled={downloading}
                onClick={() => handleDownload(createdOrder.id, createdOrder.invoiceNumber)}
              >
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </Button>

              <Button
                className="bg-primary text-primary-foreground font-bold"
                onClick={() => setLocation(`/orders/${createdOrder.id}`)}
              >
                <Eye className="w-4 h-4 mr-2" /> View Order Details
              </Button>

              <Button
                variant="secondary"
                onClick={resetForm}
              >
                <Plus className="w-4 h-4 mr-2" /> Create Another Order
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground">
                New Jewellery Order
              </h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                Billing POS
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Create a retail sales invoice and update private stock automatically.
            </p>
          </div>
        </div>

        <Link href="/catalogue">
          <Button variant="outline" size="sm" className="hidden sm:flex text-xs gap-1.5 border-border">
            <Eye className="w-3.5 h-3.5 text-primary" /> View Live Catalogue
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Customer & Product Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Details Card */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Customer Details
              </CardTitle>
              <CardDescription className="text-xs">
                Enter buyer contact details for the official GST sales invoice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="customerName" className="text-xs font-medium">
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="customerName"
                      placeholder="e.g. Priya Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customerMobile" className="text-xs font-medium">
                    Mobile Number <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="customerMobile"
                      placeholder="e.g. 9876543210 or +91..."
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value)}
                      className="pl-9 h-9 text-sm font-mono"
                    />
                  </div>
                  {normalizedMobile && normalizedMobile.length >= 10 && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                      ✓ Valid 10-digit: {normalizedMobile.slice(-10)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="customerEmail" className="text-xs text-muted-foreground">
                    Email <span className="text-[10px]">(optional)</span>
                  </Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="customer@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customerAddress" className="text-xs text-muted-foreground">
                    Billing Address <span className="text-[10px]">(optional)</span>
                  </Label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="customerAddress"
                      placeholder="City, State"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orderDate" className="text-xs font-medium flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-primary" /> Order Date
                  </Label>
                  <Input
                    id="orderDate"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="h-9 text-sm bg-background font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Jewellery Product Selector Card */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Gem className="w-4 h-4 text-primary" /> Add Jewellery Items to Bill
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Search from your current inventory stock and add items with pricing.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {inStockProducts.length} Items In Stock
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Selection Inputs */}
              <div className="space-y-3 p-3.5 rounded-xl bg-muted/30 border border-border/80">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <div className="flex-1">
                    <Label htmlFor="productSelect" className="text-xs font-medium mb-1.5 block">
                      Choose Jewellery Item
                    </Label>
                    <select
                      id="productSelect"
                      value={selectedProductId || ""}
                      onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="">-- Select from {inStockProducts.length} Available Jewellery Items --</option>
                      {inStockProducts.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.price)} ({p.availableQuantity} in stock)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <Label htmlFor="itemQty" className="text-xs font-medium mb-1.5 block">
                      Qty
                    </Label>
                    <Input
                      id="itemQty"
                      type="number"
                      min={1}
                      max={selectedProduct ? selectedProduct.availableQuantity : 999}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="h-10 text-center font-bold"
                    />
                  </div>

                  <div className="self-end sm:pt-6">
                    <Button
                      type="button"
                      onClick={() => handleAddProduct()}
                      className="h-10 w-full sm:w-auto font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Add to Bill
                    </Button>
                  </div>
                </div>

                {/* Selected Product Preview Card */}
                {selectedProduct && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                    <div className="flex items-center gap-2.5">
                      {selectedProduct.images?.[0] ? (
                        <img
                          src={selectedProduct.images[0]}
                          alt={selectedProduct.name}
                          className="w-10 h-10 rounded-md object-cover border border-border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                          <Gem className="w-5 h-5 text-primary opacity-60" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-foreground line-clamp-1">{selectedProduct.name}</p>
                        <p className="text-muted-foreground">
                          Category: <span className="text-foreground font-medium">{selectedProduct.category || "Jewellery"}</span> · Stock: <span className="text-emerald-600 font-bold">{selectedProduct.availableQuantity} units</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-serif font-bold text-sm text-primary">
                        {formatCurrency(selectedProduct.price * itemQuantity)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatCurrency(selectedProduct.price)} × {itemQuantity}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Pick Gallery for Fast 1-Click Adding */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Pick Popular Jewellery
                  </Label>
                  <div className="relative w-44">
                    <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
                    <Input
                      placeholder="Filter items..."
                      value={searchProductQuery}
                      onChange={(e) => setSearchProductQuery(e.target.value)}
                      className="h-7 pl-7 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-1 border rounded-lg bg-card/50">
                  {filteredProducts.slice(0, 9).map((p: any) => {
                    const img = p.images?.[0] || p.image;
                    const inCart = items.some((i) => i.productId === p.id);
                    return (
                      <div
                        key={p.id}
                        className={`group p-2 rounded-lg border text-xs flex flex-col justify-between transition-all ${
                          inCart
                            ? "bg-primary/5 border-primary/40 shadow-xs"
                            : "bg-background border-border hover:border-primary/50 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {img ? (
                            <img src={img} alt={p.name} className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                              <Gem className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[11px] truncate text-foreground">{p.name}</p>
                            <p className="text-primary font-serif font-bold text-xs">{formatCurrency(p.price)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {p.availableQuantity} avail
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddProduct(p, 1)}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                      No matching jewellery items found.
                    </div>
                  )}
                </div>
              </div>

              {/* Items in Current Order Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                    Current Bill Items ({items.length})
                  </Label>
                  {items.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems([])}
                      className="h-6 text-[11px] text-destructive hover:text-destructive"
                    >
                      Clear All
                    </Button>
                  )}
                </div>

                {items.length > 0 ? (
                  <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">Jewellery Item</th>
                          <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                          <th className="text-center px-3 py-2 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 font-medium">Total</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((item) => (
                          <tr key={item.productId} className="hover:bg-muted/20">
                            <td className="px-3 py-2.5 font-medium">
                              <div className="flex items-center gap-2">
                                {item.image ? (
                                  <img src={item.image} alt={item.productName} className="w-7 h-7 rounded object-cover" />
                                ) : (
                                  <div className="w-7 h-7 rounded bg-muted flex items-center justify-center">
                                    <Gem className="w-3.5 h-3.5 text-primary" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-foreground line-clamp-1">{item.productName}</p>
                                  {item.category && (
                                    <p className="text-[10px] text-muted-foreground">{item.category}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, -1)}
                                  className="w-5 h-5 rounded flex items-center justify-center bg-muted hover:bg-muted/80 text-foreground text-xs font-bold"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center font-bold text-xs font-mono">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, 1)}
                                  className="w-5 h-5 rounded flex items-center justify-center bg-muted hover:bg-muted/80 text-foreground text-xs font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-serif font-bold text-foreground">
                              {formatCurrency(item.price * item.quantity)}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removeItem(item.productId)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-dashed border-border rounded-xl py-8 flex flex-col items-center justify-center text-muted-foreground gap-2 bg-muted/10">
                    <ShoppingCart className="w-8 h-8 opacity-25" />
                    <p className="text-xs">No items added to bill yet.</p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Select a jewellery item above or click "+ Add" on any quick pick card.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Summary, Tax & Submit */}
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm sticky top-4">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-serif font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Invoice Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Financial Breakdown */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items Subtotal</span>
                  <span className="font-mono font-medium text-foreground">{formatCurrency(subtotal)}</span>
                </div>

                {/* Discount Selector */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={String(discountPercentage)}
                      onValueChange={(v) => setDiscountPercentage(Number(v))}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs px-2 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="1">1%</SelectItem>
                        <SelectItem value="2">2%</SelectItem>
                        <SelectItem value="3">3%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Discount Applied ({discountPercentage}%)</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}

                {/* GST Selector */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Jewellery GST</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary/30 text-primary">
                      Standard 3%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={String(gstPercentage)}
                      onValueChange={(v) => setGstPercentage(Number(v))}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs px-2 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="1.5">1.5%</SelectItem>
                        <SelectItem value="3">3% (Govt)</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span>GST Amount</span>
                  <span className="font-mono">{formatCurrency(gstAmount)}</span>
                </div>

                <Separator />

                <div className="flex justify-between items-baseline py-1">
                  <span className="font-serif font-bold text-sm text-foreground">Grand Total</span>
                  <span className="font-serif font-bold text-xl text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <Separator />

              {/* Payment Details */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold block text-foreground">
                  Payment Method
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["Cash", "UPI", "Card"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border cursor-pointer text-center ${
                        paymentMethod === method
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {method === "Cash" && "💵 "}
                      {method === "UPI" && "📱 "}
                      {method === "Card" && "💳 "}
                      {method}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <Label htmlFor="customPaid" className="text-muted-foreground">
                      Amount Paid (₹)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Leave empty for Full Payment
                    </span>
                  </div>
                  <Input
                    id="customPaid"
                    type="number"
                    min={0}
                    max={grandTotal}
                    placeholder={String(grandTotal)}
                    value={customPaidAmount}
                    onChange={(e) => setCustomPaidAmount(e.target.value)}
                    className="h-9 text-sm font-mono font-bold"
                  />
                  {customPaidAmount !== "" && Number(customPaidAmount) < grandTotal && (
                    <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 font-medium">
                      <span>Pending Balance:</span>
                      <span className="font-bold font-mono">
                        {formatCurrency(Math.max(0, grandTotal - Number(customPaidAmount)))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Submit Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  className="w-full h-11 font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md cursor-pointer"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Generating Invoice..." : "Create Sales Order"}
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-10 border-primary/40 text-primary hover:bg-primary/5 font-bold text-xs cursor-pointer"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                >
                  <Printer className="w-3.5 h-3.5 mr-2" />
                  Create & Print Official PDF
                </Button>
              </div>

              <div className="text-[11px] text-muted-foreground text-center pt-1">
                {items.length === 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    ⚠️ Select at least 1 jewellery item above to bill.
                  </span>
                ) : (
                  <span>
                    ✓ {items.reduce((sum, i) => sum + i.quantity, 0)} units ready to bill.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
