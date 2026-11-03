import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import {
  Gem,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Share2,
  Layers,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { FullscreenImageViewer } from "@/components/common/fullscreen-image-viewer";
import { PraoMlLink } from "@/lib/prao-link";

export default function CatalogueDetail() {
  const [, params] = useRoute("/catalogue/:id");
  const productId = params?.id;
  const { toast } = useToast();
  const { user } = useAuth();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["catalogue-product-detail", productId],
    queryFn: async () => {
      const res = await api.get(`/api/catalogue/products/${productId}`);
      return res.data;
    },
    enabled: Boolean(productId),
  });

  const product = data?.product;
  const related = data?.related || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-amber-900 font-medium tracking-wider uppercase">
            Loading Exquisite Details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="font-serif text-2xl font-bold text-neutral-900 mb-2">
            Jewellery Item Not Found
          </h2>
          <p className="text-neutral-500 text-sm mb-6">
            The requested jewellery piece may be retired or unavailable.
          </p>
          <Link href="/catalogue">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white">
              Return to Catalogue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const images: string[] = product.images?.length
    ? product.images
    : [product.primaryImage];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out this exquisite piece at SAJIRI JEWELS: ${product.name}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Product link copied to clipboard.",
      });
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hello SAJIRI JEWELS! I am interested in purchasing "${product.name}" (Ref: ${product.id}, Price: ₹${product.price.toLocaleString("en-IN")}). Is it currently available?`
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-foreground font-sans">
      {/* ── Internal Staff Bar (Logged-in Staff Only) ── */}
      {user && (
        <div className="bg-amber-950 text-amber-100 text-xs px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/60 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider text-[10px] uppercase bg-amber-800 text-amber-100 px-2 py-0.5 rounded">
              Internal Staff Mode
            </span>
            <span className="text-amber-200 text-xs">
              ID: #{product.id} • SKU: {product.supplierSku || product.sku || "—"} • Stock: {product.availableQuantity}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-amber-300 text-xs font-semibold">PRAO Supplier:</span>
            <PraoMlLink product={product} showIcon={true} className="text-amber-200 hover:text-white" />
            <Link href="/products" className="text-amber-300 hover:text-white underline text-xs">
              Open Inventory Studio
            </Link>
          </div>
        </div>
      )}

      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-amber-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/catalogue" className="flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-amber-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Catalogue
          </Link>

          <Link href="/" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="SAJIRI JEWELS" className="w-8 h-8 rounded-full shadow-xs" />
            <span className="font-serif font-bold text-lg tracking-wider text-neutral-900">
              SAJIRI JEWELS
            </span>
          </Link>

          <button
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-600 transition-colors"
            title="Share item"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Breadcrumbs ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full">
        <nav className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Link href="/" className="hover:text-amber-700">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <Link href={`/catalogue?category=${product.category}`} className="hover:text-amber-700">
            {product.category}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-900 font-medium truncate max-w-xs sm:max-w-md">
            {product.name}
          </span>
        </nav>
      </div>

      {/* ── Product Detail Section ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Image Gallery (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Primary Large Image */}
            <div
              onClick={() => setViewerOpen(true)}
              className="aspect-square w-full rounded-2xl overflow-hidden bg-white border border-amber-100/90 shadow-sm relative group cursor-zoom-in"
              title="Click to view full screen with high resolution"
              data-testid="button-open-fullscreen-image"
            >
              <img
                src={images[activeImageIndex] || product.primaryImage}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {product.discountPercentage && (
                <div className="absolute top-4 right-4 bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  {product.discountPercentage}% OFF
                </div>
              )}

              {/* Fullscreen Pill Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewerOpen(true);
                }}
                className="absolute bottom-3.5 right-3.5 bg-black/60 hover:bg-black/85 text-white backdrop-blur-md text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md transition-all opacity-85 group-hover:opacity-100 group-hover:scale-105 border border-white/20"
                title="Expand to Fullscreen View"
              >
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Full Screen</span>
              </button>
            </div>

            {/* Thumbnail Navigation */}
            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      activeImageIndex === idx
                        ? "border-amber-600 shadow-sm shadow-amber-600/30 scale-102"
                        : "border-neutral-200 opacity-70 hover:opacity-100 hover:border-amber-300"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Product Information & Purchase Inquiry (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div>
              {/* Category & Badge */}
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-amber-100 text-amber-900 border-amber-200 font-semibold text-xs tracking-wider uppercase">
                  {product.category}
                </Badge>
                {product.inStock ? (
                  <span className="flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    In Stock ({product.availableQuantity} pieces available)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-700 text-xs font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Available on Backorder
                  </span>
                )}
                {user && (
                  <div className="ml-auto flex items-center gap-1">
                    <PraoMlLink product={product} showIcon={true} />
                  </div>
                )}
              </div>

              {/* Title */}
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-900 leading-tight mb-3">
                {product.name}
              </h1>

              {/* Price Box */}
              <div className="bg-white rounded-xl p-4 border border-amber-100/90 shadow-xs mb-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-3xl font-bold text-neutral-900">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  {product.compareAtPrice && (
                    <span className="text-base text-neutral-400 line-through">
                      ₹{product.compareAtPrice.toLocaleString("en-IN")}
                    </span>
                  )}
                  {product.discountPercentage && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Save ₹{(product.compareAtPrice - product.price).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Inclusive of all taxes • Guaranteed Anti-Tarnish Finish
                </p>
              </div>

              {/* Action: WhatsApp Inquiry */}
              <div className="space-y-3 mb-8">
                <a
                  href={`https://wa.me/919876543210?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-6 rounded-xl shadow-sm transition-all transform active:scale-98 text-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  Order / Inquire via WhatsApp
                </a>
                <p className="text-[11px] text-center text-neutral-500">
                  Direct support from our jewelry consultants • Instant response
                </p>
              </div>

              {/* Specifications Card */}
              <div className="bg-white rounded-2xl p-5 border border-amber-100/90 shadow-xs space-y-4 mb-6">
                <h3 className="font-serif font-bold text-sm text-neutral-900 border-b border-neutral-100 pb-2">
                  Product Specifications
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Material</span>
                    <span className="font-semibold text-neutral-800">{product.material}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Color / Finish</span>
                    <span className="font-semibold text-neutral-800">{product.color}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Style</span>
                    <span className="font-semibold text-neutral-800">{product.style}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Design</span>
                    <span className="font-semibold text-neutral-800">{product.design}</span>
                  </div>
                  {user && (
                    <div className="col-span-2 pt-2 border-t border-neutral-100 flex items-center justify-between">
                      <span className="text-neutral-500">Internal Reference</span>
                      <span className="font-mono text-neutral-800 flex items-center gap-2">
                        <span>{product.supplierSku || product.sku || `#${product.id}`}</span>
                        <PraoMlLink product={product} showIcon={true} />
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="bg-white rounded-2xl p-5 border border-amber-100/90 shadow-xs space-y-2">
                  <h3 className="font-serif font-bold text-sm text-neutral-900">
                    Product Description
                  </h3>
                  <div
                    className="text-xs text-neutral-600 leading-relaxed space-y-2 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                </div>
              )}
            </div>

            {/* Quality Guarantees */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-amber-200/50 text-center">
              <div className="p-3 bg-white rounded-xl border border-amber-100/80">
                <ShieldCheck className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <span className="text-[10px] font-semibold text-neutral-800 block">Waterproof</span>
                <span className="text-[9px] text-neutral-500">Daily wear safe</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-100/80">
                <Sparkles className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <span className="text-[10px] font-semibold text-neutral-800 block">Anti-Tarnish</span>
                <span className="text-[9px] text-neutral-500">Long-lasting shine</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-100/80">
                <Truck className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <span className="text-[10px] font-semibold text-neutral-800 block">Insured</span>
                <span className="text-[9px] text-neutral-500">Doorstep delivery</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-16 pt-12 border-t border-amber-200/60">
            <h2 className="font-serif text-2xl font-bold text-neutral-900 mb-6">
              You May Also Adore
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {related.map((rel: any) => (
                <Link
                  key={rel.id}
                  href={`/catalogue/${rel.id}`}
                  className="group bg-white rounded-xl overflow-hidden border border-amber-100/80 shadow-xs hover:shadow-gold-md hover:border-amber-300 transition-all p-3"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-neutral-100 mb-3">
                    <img
                      src={rel.primaryImage}
                      alt={rel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h4 className="font-serif font-bold text-xs text-neutral-900 line-clamp-1 group-hover:text-amber-800">
                    {rel.name}
                  </h4>
                  <p className="font-bold text-sm text-neutral-900 mt-1">
                    ₹{rel.price.toLocaleString("en-IN")}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
        {/* Fullscreen High-Resolution Image Viewer */}
        <FullscreenImageViewer
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          images={images}
          initialIndex={activeImageIndex}
          productTitle={product.name}
          productPrice={product.price}
          productCategory={product.category}
        />
      </main>
    </div>
  );
}
