import { Router } from "express";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, sql, desc, or } from "drizzle-orm";
import { getSessionUser } from "../middlewares/auth";

const router = Router();

// Public Customer-Facing Catalogue Product Formatter
// Strictly omits all supplier costs, source URLs, and internal metadata
function formatPublicProduct(p: any) {
  const images = Array.isArray(p.images) ? p.images : [];
  const qty = Number(p.availableQuantity || 0);
  const price = Number(p.price);
  const compareAtPrice = Number(p.compareAtPrice || 0);

  return {
    id: p.id,
    name: p.name,
    description: p.description || "",
    price,
    compareAtPrice: compareAtPrice > price ? compareAtPrice : null,
    discountPercentage: compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : null,
    availableQuantity: qty,
    inStock: qty > 0,
    stockStatus: qty > 5 ? "in_stock" : qty > 0 ? "low_stock" : "out_of_stock",
    category: p.category,
    subcategory: p.subcategory || null,
    material: p.material || "Fashion Jewellery Alloy",
    color: p.color || "Gold",
    style: p.style || "Contemporary",
    design: p.design || "Modern",
    images,
    primaryImage: images[0] || "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
    secondaryImage: images[1] || images[0] || null,
    isFeatured: Boolean(p.isFeatured),
    isVerified: Boolean(p.isVerified),
    createdAt: p.createdAt,
  };
}

// GET /api/catalogue/products (Public)
// Only returns verified and active catalogue items to guarantee authenticity
router.get("/catalogue/products", async (req, res): Promise<void> => {
  try {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const material = req.query.material as string | undefined;
    const inStockOnly = req.query.inStock === "true";
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const sort = req.query.sort as string | undefined; // 'price_asc' | 'price_desc' | 'newest'
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = (page - 1) * limit;

    // Filter strictly for active AND verified items
    const conditions = [
      eq(productsTable.isActive, true),
      eq(productsTable.isVerified, true),
    ];

    if (category && category !== "all") {
      conditions.push(ilike(productsTable.category, category));
    }
    if (material) {
      conditions.push(ilike(productsTable.material, `%${material}%`));
    }
    if (inStockOnly) {
      conditions.push(sql`${productsTable.availableQuantity} > 0`);
    }
    if (minPrice !== undefined && !isNaN(minPrice)) {
      conditions.push(gte(productsTable.price, String(minPrice)));
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      conditions.push(lte(productsTable.price, String(maxPrice)));
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(productsTable.name, q),
          ilike(productsTable.description, q),
          ilike(productsTable.category, q),
          ilike(productsTable.material, q)
        )!
      );
    }

    const whereClause = and(...conditions);

    // Sort order
    let orderByClause = desc(productsTable.createdAt);
    if (sort === "price_asc") {
      orderByClause = sql`${productsTable.price}::numeric asc` as any;
    } else if (sort === "price_desc") {
      orderByClause = sql`${productsTable.price}::numeric desc` as any;
    } else if (sort === "name_asc") {
      orderByClause = sql`${productsTable.name} asc` as any;
    }

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productsTable)
      .where(whereClause);

    const items = await db
      .select()
      .from(productsTable)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    res.json({
      data: items.map(formatPublicProduct),
      total: totalRow.count,
      page,
      limit,
      totalPages: Math.ceil(totalRow.count / limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch catalogue products" });
  }
});

// GET /api/catalogue/products/:id (Public)
router.get("/catalogue/products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  try {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.isActive, true), eq(productsTable.isVerified, true)));

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Also fetch related products in same category (strictly verified and active)
    const related = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.isActive, true),
          eq(productsTable.isVerified, true),
          eq(productsTable.category, product.category),
          sql`${productsTable.id} != ${id}`
        )
      )
      .limit(4);

    // Format product details; attach private supplier metadata ONLY for logged-in staff
    const user = await getSessionUser(req);
    const formatted = formatPublicProduct(product);
    if (user) {
      (formatted as any).sourceUrl = product.sourceUrl;
      (formatted as any).supplierSku = product.supplierSku;
      (formatted as any).supplierProductId = product.supplierProductId;
      (formatted as any).sku = product.sku;
    }

    res.json({
      product: formatted,
      related: related.map(formatPublicProduct),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load product details" });
  }
});

// GET /api/catalogue/featured (Public)
router.get("/catalogue/featured", async (_req, res): Promise<void> => {
  try {
    const featured = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.isActive, true), eq(productsTable.isVerified, true)))
      .orderBy(desc(productsTable.isFeatured), desc(productsTable.id))
      .limit(8);

    res.json(featured.map(formatPublicProduct));
  } catch (error) {
    res.status(500).json({ error: "Failed to load featured products" });
  }
});

export default router;
