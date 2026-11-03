import React from "react";
import { ExternalLink } from "lucide-react";

/**
 * Resolves the matching original PRAO product page URL.
 * Handles verified sourceUrl, supplierSku, supplierProductId, or SKU.
 */
export function getMatchingPraoUrl(product: any): string | null {
  if (!product) return null;

  // 1. Explicit verified source URL
  const sourceUrl = (product.sourceUrl || product.source_url || "").trim();
  if (sourceUrl && sourceUrl.includes("prao.com")) {
    return sourceUrl;
  }

  // 2. By supplier SKU (Shopify product handle format on prao.com: /products/{sku})
  const supSku = (product.supplierSku || product.supplier_sku || "").trim();
  if (supSku) {
    return `https://prao.com/products/${supSku.toLowerCase()}`;
  }

  // 3. By supplier product ID (Shopify numeric product ID query)
  const supId = (product.supplierProductId || product.supplier_product_id || "").trim();
  if (supId) {
    return `https://prao.com/products?q=${encodeURIComponent(supId)}`;
  }

  // 4. Fallback from store SKU if it carries the supplier or numeric pattern
  const sku = (product.sku || "").trim();
  if (sku) {
    if (sku.startsWith("SJ-")) {
      const numericId = sku.replace(/^SJ-/, "");
      return `https://prao.com/products?q=${encodeURIComponent(numericId)}`;
    }
    // If SKU matches PRAO format (e.g. 5751PR, 6053PR, 6372MR, etc.)
    if (/^[0-9]{3,5}[a-zA-Z]{1,3}$/i.test(sku)) {
      return `https://prao.com/products/${sku.toLowerCase()}`;
    }
  }

  return null;
}

export interface PraoMlLinkProps {
  product: any;
  className?: string;
  showIcon?: boolean;
}

/**
 * Small, discreet ML hyperlink that opens the matching original PRAO product page in a new tab.
 */
export function PraoMlLink({ product, className = "", showIcon = false }: PraoMlLinkProps) {
  const url = getMatchingPraoUrl(product);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-neutral-400 hover:text-amber-800 dark:text-neutral-500 dark:hover:text-amber-400 underline decoration-dotted underline-offset-2 transition-colors select-none ${className}`}
      title="Open matching original PRAO product page in a new tab"
      onClick={(e) => e.stopPropagation()}
      data-testid="link-private-prao-ml"
    >
      <span>ML</span>
      {showIcon && <ExternalLink className="w-2.5 h-2.5 opacity-60 inline" />}
    </a>
  );
}

