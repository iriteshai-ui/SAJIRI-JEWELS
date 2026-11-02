import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Gem,
  Crown,
  ChevronRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  LogIn,
  Layers,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { DataTablePagination } from "@/components/common/data-table-pagination";

export default function Catalogue() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("all");
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<string>("newest");
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/api/categories");
      return res.data;
    },
  });

  // Fetch Products
  const { data: catalogueData, isLoading } = useQuery({
    queryKey: [
      "catalogue-products",
      selectedCategory,
      searchQuery,
      selectedMaterial,
      inStockOnly,
      sortOption,
      displayLimit,
      currentPage,
    ],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: currentPage,
        limit: displayLimit,
        sort: sortOption,
      };
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (selectedMaterial !== "all") params.material = selectedMaterial;
      if (inStockOnly) params.inStock = "true";
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get("/api/catalogue/products", { params });
      return res.data;
    },
  });

  const products = catalogueData?.data || [];
  const totalCount = catalogueData?.total || 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-foreground font-sans">
      {/* ── Luxury Announcement Bar ── */}
      <div className="bg-[#1A1A1A] text-amber-100/90 text-xs py-2 px-4 text-center tracking-wider flex items-center justify-center gap-4 border-b border-amber-900/30">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          SAJIRI JEWELS • Handcrafted Anti-Tarnish &amp; Waterproof Collections
        </span>
        <span className="hidden md:inline text-amber-400/50">|</span>
        <span className="hidden md:inline text-amber-200/80">
          Complimentary Luxury Gift Box on All Orders
        </span>
      </div>

      {/* ── Brand Navigation Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-amber-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/favicon.svg"
              alt="SAJIRI JEWELS"
              className="w-10 h-10 rounded-full shadow-gold-sm transition-transform group-hover:scale-105"
            />
            <div>
              <span className="font-serif font-bold text-xl tracking-wider text-neutral-900 group-hover:text-amber-700 transition-colors">
                SAJIRI JEWELS
              </span>
              <p className="text-[10px] text-neutral-600 tracking-widest uppercase font-medium">
                Haute Fashion Jewellery
              </p>
            </div>
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md relative mx-4">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
            <Input
              type="text"
              placeholder="Search necklaces, earrings, rings, bangles..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9.5 pr-4 py-2 bg-neutral-50/80 border-amber-200/60 rounded-full text-sm focus-visible:ring-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="border-neutral-300 text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900 text-xs font-semibold rounded-full px-4 gap-1.5 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-600" />
                Staff Portal
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <Input
              type="text"
              placeholder="Search jewellery catalogue..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-3 py-1.5 bg-neutral-50 border-amber-200/60 rounded-full text-xs"
            />
          </div>
        </div>
      </header>

      {/* ── Category Navigation Bar ── */}
      <div className="bg-white border-b border-amber-100 overflow-x-auto scrollbar-none py-2.5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <button
            onClick={() => { setSelectedCategory("all"); setCurrentPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === "all"
                ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30 font-semibold"
                : "bg-neutral-100 text-neutral-700 hover:bg-amber-50 hover:text-amber-800"
            }`}
          >
            All Collections
          </button>
          {categories.map((cat: any) => {
            const isSelected =
              selectedCategory.toLowerCase() === cat.name.toLowerCase() ||
              selectedCategory.toLowerCase() === cat.slug.toLowerCase();
            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.name); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30 font-semibold"
                    : "bg-neutral-100 text-neutral-700 hover:bg-amber-50 hover:text-amber-800"
                }`}
              >
                <span>{cat.name}</span>
                {cat.productCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {cat.productCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Catalogue Body ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Banner Card */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-neutral-900 via-neutral-800 to-amber-950 text-white p-8 sm:p-10 mb-8 shadow-md border border-amber-900/40">
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 mb-2 text-amber-400 text-xs font-semibold tracking-widest uppercase">
              <Crown className="w-4 h-4" />
              Signature Collection 2026
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-amber-50 mb-3">
              Pure Elegance. Everyday Luxury.
            </h1>
            <p className="text-amber-200/80 text-sm sm:text-base leading-relaxed mb-6 font-light">
              Crafted in premium anti-tarnish stainless steel &amp; 18K gold
              plating. Designed to shine through every occasion without losing its
              luster.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-amber-100/90 font-medium">
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/10">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Anti-Tarnish Guaranteed
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/10">
                <Truck className="w-4 h-4 text-amber-400" />
                Express Safe Delivery
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/10">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Quality Assurance
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-amber-200/60">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold text-neutral-800">
              {selectedCategory === "all" ? "All Jewellery" : selectedCategory}
            </span>
            <Badge variant="secondary" className="bg-amber-100/80 text-amber-900 font-medium">
              {totalCount} Items
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Select */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className="h-8 text-xs bg-white border-amber-200/70 rounded-lg w-[140px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Latest Arrivals</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="name_asc">Name: A to Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-3 border border-neutral-200 animate-pulse space-y-3"
              >
                <div className="w-full aspect-square bg-neutral-200 rounded-lg" />
                <div className="h-4 bg-neutral-200 rounded w-3/4" />
                <div className="h-3 bg-neutral-200 rounded w-1/2" />
                <div className="h-4 bg-neutral-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-amber-200 p-8">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="font-serif text-xl font-bold text-neutral-800 mb-2">
              No Jewellery Found
            </h3>
            <p className="text-neutral-500 text-sm max-w-md mx-auto mb-6">
              We couldn't find any products matching your current category or search
              filters. Try clearing your search query.
            </p>
            <Button
              onClick={() => {
                setSelectedCategory("all");
                setSearchQuery("");
                setSelectedMaterial("all");
              }}
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-50"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((item: any) => {
              return (
                <Link
                  key={item.id}
                  href={`/catalogue/${item.id}`}
                  className="group bg-white rounded-xl overflow-hidden border border-amber-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-gold-md hover:border-amber-300 transition-all duration-300 flex flex-col"
                >
                  {/* Image Container with secondary hover swap */}
                  <div className="relative aspect-square w-full bg-neutral-100 overflow-hidden">
                    <img
                      src={item.primaryImage}
                      alt={item.name}
                      loading="lazy"
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                        item.secondaryImage ? "group-hover:opacity-0" : ""
                      }`}
                    />
                    {item.secondaryImage && (
                      <img
                        src={item.secondaryImage}
                        alt={`${item.name} alternate view`}
                        loading="lazy"
                        className="w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-100 group-hover:scale-105"
                      />
                    )}

                    {/* Stock Status Pill */}
                    <div className="absolute top-2.5 left-2.5">
                      {item.inStock ? (
                        <span className="bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                          In Stock
                        </span>
                      ) : (
                        <span className="bg-neutral-800/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                          Made to Order
                        </span>
                      )}
                    </div>

                    {/* Discount Badge */}
                    {item.discountPercentage && (
                      <div className="absolute top-2.5 right-2.5 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        {item.discountPercentage}% OFF
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-amber-700/80 uppercase tracking-wider mb-1">
                        {item.category}
                      </p>
                      <h3 className="font-serif font-bold text-sm text-neutral-900 line-clamp-2 leading-snug group-hover:text-amber-800 transition-colors">
                        {item.name}
                      </h3>
                      {item.material && (
                        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1 font-light">
                          {item.material}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-base text-neutral-900">
                            ₹{item.price.toLocaleString("en-IN")}
                          </span>
                          {item.compareAtPrice && (
                            <span className="text-xs text-neutral-400 line-through">
                              ₹{item.compareAtPrice.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-amber-700 group-hover:translate-x-0.5 transition-transform">
                        View &rarr;
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Full Interactive Pagination */}
        {!isLoading && totalCount > 0 && (
          <div className="mt-12 bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-amber-200/60 shadow-sm">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={catalogueData?.totalPages || Math.ceil(totalCount / displayLimit)}
              pageSize={displayLimit}
              totalItems={totalCount}
              onPageChange={(p) => {
                setCurrentPage(p);
                window.scrollTo({ top: 380, behavior: "smooth" });
              }}
              onPageSizeChange={(newSize) => {
                setDisplayLimit(newSize);
                setCurrentPage(1);
                window.scrollTo({ top: 380, behavior: "smooth" });
              }}
              pageSizeOptions={[24, 48, 100, 200]}
              itemLabel="jewellery pieces"
            />
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-neutral-900 text-neutral-400 text-xs py-10 border-t border-neutral-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <span className="font-serif font-bold text-lg text-amber-100 tracking-wider">
                SAJIRI JEWELS
              </span>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Modern anti-tarnish fashion jewellery curated for the contemporary
                soul. Waterproof, sweat-proof, and designed for every celebration.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-amber-200 uppercase tracking-wider text-[11px] mb-3">
                Collections
              </h4>
              <ul className="space-y-2">
                <li><a href="/catalogue?category=Necklaces" className="hover:text-amber-300">Necklaces &amp; Chokers</a></li>
                <li><a href="/catalogue?category=Earrings" className="hover:text-amber-300">Earrings &amp; Studs</a></li>
                <li><a href="/catalogue?category=Bracelets" className="hover:text-amber-300">Bracelets &amp; Bangles</a></li>
                <li><a href="/catalogue?category=Rings" className="hover:text-amber-300">Statement &amp; Band Rings</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-amber-200 uppercase tracking-wider text-[11px] mb-3">
                Quality Standards
              </h4>
              <ul className="space-y-2">
                <li>100% Anti-Tarnish Finish</li>
                <li>Hypoallergenic &amp; Skin Friendly</li>
                <li>Waterproof Daily Wear</li>
                <li>Secure Luxury Packaging</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-amber-200 uppercase tracking-wider text-[11px] mb-3">
                Contact &amp; Inquiries
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                For custom orders, bridal trousseau, or wholesale inquiries, connect
                with our jewellery consultants.
              </p>
              <Link href="/login" className="text-amber-400 hover:text-amber-300 font-medium">
                Store Admin Login &rarr;
              </Link>
            </div>
          </div>
          <div className="pt-6 border-t border-neutral-800 text-center text-neutral-500 text-[11px]">
            &copy; {new Date().getFullYear()} SAJIRI JEWELS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
