import { Router } from "express";
import { db, productsTable, inventoryTable, categoriesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

// Category mapping helper
function mapToInternalCategory(productType: string, tags: string[] = []): string {
  const combined = `${productType} ${tags.join(" ")}`.toLowerCase();

  if (combined.includes("earring") || combined.includes("dangler") || combined.includes("stud") || combined.includes("jhumka") || combined.includes("hoop") || combined.includes("huggie")) {
    return "Earrings";
  }
  if (combined.includes("necklace set") || combined.includes("choker set") || combined.includes("bridal set")) {
    return "Necklace Sets";
  }
  if (combined.includes("necklace") || combined.includes("choker") || combined.includes("hasli") || combined.includes("chain")) {
    return "Necklaces";
  }
  if (combined.includes("mangalsutra")) {
    return "Mangalsutra";
  }
  if (combined.includes("bangle") || combined.includes("kada")) {
    return "Bangles";
  }
  if (combined.includes("bracelet")) {
    return "Bracelets";
  }
  if (combined.includes("ring")) {
    return "Rings";
  }
  if (combined.includes("pendant")) {
    return "Pendants";
  }
  if (combined.includes("anklet") || combined.includes("payal")) {
    return "Anklets";
  }
  if (combined.includes("maang tikka") || combined.includes("tikka") || combined.includes("sheeshpatti")) {
    return "Maang Tikka";
  }
  if (combined.includes("hair") || combined.includes("scrunchie") || combined.includes("clip") || combined.includes("claw")) {
    return "Hair Accessories";
  }
  if (combined.includes("set")) {
    return "Jewellery Sets";
  }
  return "Other Fashion Accessories";
}

// Clean title: removes "PRAO " prefix and supplier codes
function cleanTitle(rawTitle: string): string {
  return rawTitle
    .replace(/^prao\s+/i, "")
    .replace(/\banti-tarnish\b/gi, "Anti-Tarnish")
    .trim();
}

// Clean description: removes any supplier branding or links
function cleanDescription(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/prao/gi, "")
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1") // strip hyperlinks
    .trim();
}

// Infer material from tags and title
function inferMaterial(title: string, tags: string[] = []): string {
  const combined = `${title} ${tags.join(" ")}`.toLowerCase();
  if (combined.includes("anti-tarnish") || combined.includes("stainless steel")) {
    return "Anti-Tarnish Stainless Steel (Waterproof & Hypoallergenic)";
  }
  if (combined.includes("18k") || combined.includes("gold plated")) {
    return "18K Gold Plated Brass Alloy";
  }
  if (combined.includes("rhodium") || combined.includes("silver plated")) {
    return "Rhodium Plated Brass Alloy";
  }
  if (combined.includes("pearl")) {
    return "Handcrafted Pearl & Gold Plated Alloy";
  }
  if (combined.includes("crystal") || combined.includes("kundan")) {
    return "High Grade Crystal Stones & Brass Alloy";
  }
  return "Premium Anti-Tarnish Fashion Jewellery Alloy";
}

// GET /api/importer/collections - returns available collections from PRAO
router.get("/importer/collections", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const response = await fetch("https://prao.com/collections.json", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!response.ok) {
      res.status(502).json({ error: "Failed to connect to supplier collection catalog" });
      return;
    }
    const data = await response.json();
    const cleanCollections = (data.collections || []).map((c: any) => ({
      id: c.id,
      title: c.title.replace(/prao/gi, "").trim(),
      handle: c.handle,
      productsCount: c.products_count,
    }));
    res.json(cleanCollections);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load supplier collections" });
  }
});

// GET /api/importer/preview - fetch, sanitize and preview products for import
router.get("/importer/preview", requireAdmin, async (req, res): Promise<void> => {
  try {
    const collectionHandle = req.query.collection as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Number(req.query.page) || 1;

    let targetUrl = "https://prao.com/products.json";
    if (collectionHandle && collectionHandle !== "all") {
      targetUrl = `https://prao.com/collections/${collectionHandle}/products.json`;
    }
    const url = new URL(targetUrl);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });

    if (!response.ok) {
      res.status(502).json({ error: "Unable to retrieve products from source" });
      return;
    }

    const data = await response.json();
    const rawProducts = data.products || [];

    // Check existing products in our DB to flag already imported items
    const existingProducts = await db
      .select({
        supplierProductId: productsTable.supplierProductId,
        sku: productsTable.sku,
      })
      .from(productsTable);

    const existingIdSet = new Set(existingProducts.map(p => p.supplierProductId).filter(Boolean));
    const existingSkuSet = new Set(existingProducts.map(p => p.sku).filter(Boolean));

    const previewItems = rawProducts.map((p: any) => {
      const primaryVariant = p.variants?.[0] || {};
      const supplierCost = Number(primaryVariant.price || 0);
      const comparePrice = Number(primaryVariant.compare_at_price || 0);

      // Smart Retail Price Suggestion:
      // If supplier comparison price is available and sensible, use it as retail price.
      // Otherwise apply a standard 3x - 4x retail markup on wholesale cost.
      let suggestedRetailPrice = comparePrice > supplierCost ? comparePrice : Math.round(supplierCost * 3.5);
      if (suggestedRetailPrice < 499) suggestedRetailPrice = 499;

      const cleanedName = cleanTitle(p.title);
      const cleanedDesc = cleanDescription(p.body_html);
      const detectedCategory = mapToInternalCategory(p.product_type, p.tags);
      const detectedMaterial = inferMaterial(p.title, p.tags);
      const colorOption = p.options?.find((o: any) => o.name?.toUpperCase() === "COLOR")?.values?.[0] || primaryVariant.title || "Gold";
      const sku = primaryVariant.sku || `RJ-${p.id}`;

      const galleryImages = (p.images || []).map((img: any) => img.src);

      const isAlreadyImported = existingIdSet.has(String(p.id)) || (sku && existingSkuSet.has(sku));

      return {
        sourceId: String(p.id),
        name: cleanedName,
        description: cleanedDesc,
        suggestedCategory: detectedCategory,
        material: detectedMaterial,
        color: colorOption,
        style: "Contemporary",
        sku,
        supplierCost,
        retailPrice: suggestedRetailPrice,
        compareAtPrice: comparePrice || (suggestedRetailPrice * 1.3),
        initialStock: 10,
        images: galleryImages,
        primaryImage: galleryImages[0] || "",
        isAlreadyImported,
      };
    });

    res.json({
      items: previewItems,
      totalFetched: previewItems.length,
      page,
      limit,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to preview import products" });
  }
});

const bulkImportItemSchema = z.object({
  sourceId: z.string(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  category: z.string().min(1),
  subcategory: z.string().optional().default(""),
  material: z.string().optional().default("Anti-Tarnish Premium Alloy"),
  color: z.string().optional().default("Gold"),
  style: z.string().optional().default("Contemporary"),
  sku: z.string().optional(),
  retailPrice: z.number().positive(),
  compareAtPrice: z.number().optional().default(0),
  supplierCost: z.number().optional().default(0),
  stock: z.number().int().min(0).default(5),
  images: z.array(z.string()).default([]),
});

const bulkImportSchema = z.object({
  products: z.array(bulkImportItemSchema).min(1),
});

// POST /api/importer/import - execute import of selected products
router.post("/importer/import", requireAdmin, async (req, res): Promise<void> => {
  const parsed = bulkImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = req.user;
  const items = parsed.data.products;
  const importedResults = [];
  let skippedDuplicates = 0;

  // Cache existing categories to link categoryId
  const dbCategories = await db.select().from(categoriesTable);
  const catMap = new Map(dbCategories.map(c => [c.name.toLowerCase(), c.id]));

  for (const item of items) {
    // Check if already imported
    const [existing] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(
        or(
          eq(productsTable.supplierProductId, item.sourceId),
          item.sku ? eq(productsTable.sku, item.sku) : undefined
        )
      );

    if (existing) {
      skippedDuplicates++;
      continue;
    }

    const catId = catMap.get(item.category.toLowerCase()) || null;

    const [createdProduct] = await db
      .insert(productsTable)
      .values({
        name: item.name,
        description: item.description,
        price: String(item.retailPrice),
        compareAtPrice: String(item.compareAtPrice || item.retailPrice * 1.3),
        availableQuantity: item.stock,
        sku: item.sku || `RJ-${Date.now()}`,
        categoryId: catId,
        category: item.category,
        subcategory: item.subcategory || "",
        material: item.material,
        color: item.color,
        style: item.style,
        images: item.images,
        isFeatured: false,
        isActive: true,
        // Internal supplier tracking (Admin only)
        supplierCost: String(item.supplierCost),
        supplierSource: "prao",
        supplierProductId: item.sourceId,
        supplierSku: item.sku || "",
      })
      .returning();

    // Log initial inventory entry
    if (item.stock > 0) {
      await db.insert(inventoryTable).values({
        productId: createdProduct.id,
        productName: createdProduct.name,
        previousQuantity: 0,
        quantityAdded: item.stock,
        quantityReduced: 0,
        currentQuantity: item.stock,
        actionType: "add",
        updatedById: user?.id,
      });
    }

    importedResults.push(createdProduct);
  }

  res.json({
    message: `Successfully imported ${importedResults.length} jewellery products.`,
    importedCount: importedResults.length,
    skippedDuplicates,
  });
});

export default router;
