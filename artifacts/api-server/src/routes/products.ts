import { Router } from "express";
import { db, productsTable, categoriesTable, inventoryTable, orderItemsTable } from "@workspace/db";
import { eq, ilike, sql, desc, and, or, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, getSessionUser } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const listProductsQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
  category: z.string().optional(),
  metalType: z.string().optional(),
  verificationStatus: z.string().optional(), // 'all' | 'verified' | 'unverified' | 'delisted'
});

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  price: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().optional().default(0),
  availableQuantity: z.coerce.number().int().min(0).default(0),
  sku: z.string().optional().default(""),
  categoryId: z.number().nullable().optional(),
  category: z.string().optional().default("Jewellery"),
  subcategory: z.string().optional().default(""),
  metalType: z.string().optional().default("Gold Plated"),
  purity: z.string().optional().default("Anti-Tarnish"),
  material: z.string().optional().default("Anti-Tarnish Premium Alloy"),
  color: z.string().optional().default("Gold"),
  style: z.string().optional().default("Contemporary"),
  design: z.string().optional().default("Modern"),
  images: z.array(z.string()).optional().default([]),
  grossWeight: z.coerce.number().optional().default(0),
  netWeight: z.coerce.number().optional().default(0),
  stoneWeight: z.coerce.number().optional().default(0),
  makingChargesType: z.string().optional().default("per_gram"),
  makingChargesValue: z.coerce.number().optional().default(0),
  hallmarkUid: z.string().optional(),
  hsnCode: z.string().optional().default("7113"),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  supplierCost: z.coerce.number().optional().default(0),
  supplierSource: z.string().optional().default(""),
  supplierProductId: z.string().optional().default(""),
  supplierSku: z.string().optional().default(""),
  isVerified: z.boolean().optional().default(false),
  sourceUrl: z.string().optional().default(""),
  verificationStatus: z.string().optional().default("unverified"),
  verificationNotes: z.string().optional().default(""),
});

const updateProductSchema = createProductSchema.partial();

function formatProduct(p: any) {
  return {
    ...p,
    price: Number(p.price),
    compareAtPrice: Number(p.compareAtPrice || 0),
    supplierCost: Number(p.supplierCost || 0),
    grossWeight: Number(p.grossWeight || 0),
    netWeight: Number(p.netWeight || 0),
    stoneWeight: Number(p.stoneWeight || 0),
    makingChargesValue: Number(p.makingChargesValue || 0),
    images: Array.isArray(p.images) ? p.images : [],
    isVerified: Boolean(p.isVerified),
    sourceUrl: p.sourceUrl || "",
    verificationStatus: p.verificationStatus || "unverified",
    verificationNotes: p.verificationNotes || "",
    orderCount: Number(p.orderCount || 0),
  };
}

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const query = listProductsQuery.safeParse(req.query);
  const search = query.success ? query.data.search : undefined;
  const category = query.success ? query.data.category : undefined;
  const verificationStatus = query.success ? query.data.verificationStatus : undefined;
  const page = query.success ? query.data.page : 1;
  const limit = Math.min(query.success ? (query.data.limit || 100) : 100, 500);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(ilike(productsTable.name, `%${search}%`));
  }
  if (category && category !== "all") {
    conditions.push(eq(productsTable.category, category));
  }
  if (verificationStatus && verificationStatus !== "all") {
    if (verificationStatus === "verified") {
      conditions.push(eq(productsTable.isVerified, true));
    } else if (verificationStatus === "unverified") {
      conditions.push(or(eq(productsTable.isVerified, false), eq(productsTable.verificationStatus, "unverified"))!);
    } else if (verificationStatus === "delisted") {
      conditions.push(eq(productsTable.verificationStatus, "delisted"));
    }
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(whereClause);

  const data = await db
    .select()
    .from(productsTable)
    .where(whereClause)
    .orderBy(desc(productsTable.id))
    .limit(limit)
    .offset(offset);

  // Fetch sales history (order counts) for returned products
  const productIds = data.map((p) => p.id);
  const orderCountsMap = new Map<number, number>();

  if (productIds.length > 0) {
    const orderRows = await db
      .select({
        productId: orderItemsTable.productId,
        count: sql<number>`count(*)::int`,
      })
      .from(orderItemsTable)
      .where(inArray(orderItemsTable.productId, productIds))
      .groupBy(orderItemsTable.productId);

    for (const r of orderRows) {
      orderCountsMap.set(r.productId, r.count);
    }
  }

  res.json({
    data: data.map((p) => formatProduct({ ...p, orderCount: orderCountsMap.get(p.id) || 0 })),
    total: totalRow.count,
    page,
    limit,
    totalPages: Math.ceil(totalRow.count / limit),
  });
});

router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;
  const [product] = await db
    .insert(productsTable)
    .values({
      name: body.name,
      description: body.description ?? "",
      price: String(body.price),
      compareAtPrice: String(body.compareAtPrice || 0),
      availableQuantity: body.availableQuantity ?? 0,
      sku: body.sku || `SJ-${Date.now()}`,
      categoryId: body.categoryId ?? null,
      category: body.category || "Jewellery",
      subcategory: body.subcategory || "",
      metalType: body.metalType || "Gold Plated",
      purity: body.purity || "Anti-Tarnish",
      material: body.material || "Anti-Tarnish Premium Alloy",
      color: body.color || "Gold",
      style: body.style || "Contemporary",
      design: body.design || "Modern",
      images: body.images || [],
      grossWeight: String(body.grossWeight || 0),
      netWeight: String(body.netWeight || 0),
      stoneWeight: String(body.stoneWeight || 0),
      makingChargesType: body.makingChargesType || "per_gram",
      makingChargesValue: String(body.makingChargesValue || 0),
      hallmarkUid: body.hallmarkUid || null,
      hsnCode: body.hsnCode || "7113",
      isFeatured: body.isFeatured ?? false,
      isActive: body.isActive ?? true,
      supplierCost: String(body.supplierCost || 0),
      supplierSource: body.supplierSource || "",
      supplierProductId: body.supplierProductId || "",
      supplierSku: body.supplierSku || "",
      isVerified: body.isVerified ?? false,
      sourceUrl: body.sourceUrl || "",
      verificationStatus: body.verificationStatus || (body.isVerified ? "verified" : "unverified"),
      verificationNotes: body.verificationNotes || "",
      verifiedAt: body.isVerified ? new Date() : null,
    })
    .returning();

  const user = await getSessionUser(req);
  if ((product.availableQuantity ?? 0) > 0) {
    await db.insert(inventoryTable).values({
      productId: product.id,
      productName: product.name,
      previousQuantity: 0,
      quantityAdded: product.availableQuantity,
      quantityReduced: null,
      currentQuantity: product.availableQuantity,
      actionType: "add",
      updatedById: user?.id ?? null,
    });
  }

  res.status(201).json(formatProduct(product));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(formatProduct(product));
});

router.patch("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingProduct] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));

  if (!existingProduct) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const body = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.price !== undefined) updateData.price = String(body.price);
  if (body.compareAtPrice !== undefined) updateData.compareAtPrice = String(body.compareAtPrice);
  if (body.availableQuantity !== undefined) updateData.availableQuantity = body.availableQuantity;
  if (body.sku !== undefined) updateData.sku = body.sku;
  if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.subcategory !== undefined) updateData.subcategory = body.subcategory;
  if (body.metalType !== undefined) updateData.metalType = body.metalType;
  if (body.purity !== undefined) updateData.purity = body.purity;
  if (body.material !== undefined) updateData.material = body.material;
  if (body.color !== undefined) updateData.color = body.color;
  if (body.style !== undefined) updateData.style = body.style;
  if (body.design !== undefined) updateData.design = body.design;
  if (body.images !== undefined) updateData.images = body.images;
  if (body.grossWeight !== undefined) updateData.grossWeight = String(body.grossWeight);
  if (body.netWeight !== undefined) updateData.netWeight = String(body.netWeight);
  if (body.stoneWeight !== undefined) updateData.stoneWeight = String(body.stoneWeight);
  if (body.makingChargesType !== undefined) updateData.makingChargesType = body.makingChargesType;
  if (body.makingChargesValue !== undefined) updateData.makingChargesValue = String(body.makingChargesValue);
  if (body.hallmarkUid !== undefined) updateData.hallmarkUid = body.hallmarkUid;
  if (body.hsnCode !== undefined) updateData.hsnCode = body.hsnCode;
  if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.supplierCost !== undefined) updateData.supplierCost = String(body.supplierCost);
  if (body.isVerified !== undefined) {
    updateData.isVerified = body.isVerified;
    if (body.isVerified && !existingProduct.isVerified) {
      updateData.verifiedAt = new Date();
    }
  }
  if (body.sourceUrl !== undefined) updateData.sourceUrl = body.sourceUrl;
  if (body.verificationStatus !== undefined) updateData.verificationStatus = body.verificationStatus;
  if (body.verificationNotes !== undefined) updateData.verificationNotes = body.verificationNotes;

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Record inventory audit transaction log
  const user = await getSessionUser(req);
  const prevQty = existingProduct.availableQuantity;
  const currentQty = product.availableQuantity;
  const qtyDiff = currentQty - prevQty;

  let actionType = "update";
  let qtyAdded: number | null = null;
  let qtyReduced: number | null = null;

  if (qtyDiff > 0) {
    actionType = "add";
    qtyAdded = qtyDiff;
  } else if (qtyDiff < 0) {
    actionType = "reduce";
    qtyReduced = Math.abs(qtyDiff);
  }

  await db.insert(inventoryTable).values({
    productId: product.id,
    productName: product.name,
    previousQuantity: prevQty,
    quantityAdded: qtyAdded,
    quantityReduced: qtyReduced,
    currentQuantity: currentQty,
    actionType: actionType,
    updatedById: user?.id ?? null,
  });

  res.json(formatProduct(product));
});

router.delete("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  // CRITICAL REQUIREMENT: Never delete sales history or existing records automatically
  // Check if product is referenced in customer orders
  const orderCheck = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.productId, id));

  const orderCount = orderCheck[0]?.count || 0;
  if (orderCount > 0) {
    res.status(400).json({
      error: `PROTECTED RECORD: Cannot delete this product because it has sales history (linked to ${orderCount} customer invoice item(s)). Deactivate the product instead to safely hide it from active listings without corrupting financial records.`,
      hasSalesHistory: true,
      orderCount,
    });
    return;
  }

  // Remove linked inventory logs before product deletion (if no sales history exists)
  await db.delete(inventoryTable).where(eq(inventoryTable.productId, id));

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
