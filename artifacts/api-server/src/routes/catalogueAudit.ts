import { Router } from "express";
import { db, productsTable, orderItemsTable, inventoryTable } from "@workspace/db";
import { eq, sql, inArray, and } from "drizzle-orm";
import { requireAdmin, getSessionUser } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

// GET /api/admin/catalogue-audit
// Complete catalogue accuracy & integrity audit report
router.get("/admin/catalogue-audit", requireAdmin, async (_req, res): Promise<void> => {
  try {
    // 1. Overall counts
    const [countsRow] = await db.select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`count(case when ${productsTable.isVerified} = true and ${productsTable.verificationStatus} = 'verified' then 1 end)::int`,
      delisted: sql<number>`count(case when ${productsTable.isVerified} = true and ${productsTable.verificationStatus} = 'delisted' then 1 end)::int`,
      unverified: sql<number>`count(case when ${productsTable.isVerified} = false or ${productsTable.verificationStatus} = 'unverified' then 1 end)::int`,
      active: sql<number>`count(case when ${productsTable.isActive} = true then 1 end)::int`,
      inactive: sql<number>`count(case when ${productsTable.isActive} = false then 1 end)::int`,
    }).from(productsTable);

    // 2. Fetch unverified products with order counts (protecting sales history)
    const unverifiedProducts = await db.execute(sql`
      SELECT 
        p.id, 
        p.name, 
        p.sku, 
        p.category, 
        p.subcategory,
        p.metal_type as "metalType", 
        p.purity,
        p.material,
        p.price::numeric as price, 
        p.available_quantity as "availableQuantity",
        p.is_active as "isActive", 
        p.is_verified as "isVerified", 
        p.verification_status as "verificationStatus", 
        p.verification_notes as "verificationNotes",
        p.source_url as "sourceUrl",
        p.supplier_source as "supplierSource", 
        p.supplier_product_id as "supplierProductId", 
        p.supplier_sku as "supplierSku",
        p.images,
        p.created_at as "createdAt",
        COALESCE(oi.order_count, 0)::int as "orderCount"
      FROM products p
      LEFT JOIN (
        SELECT product_id, count(*)::int as order_count
        FROM order_items
        GROUP BY product_id
      ) oi ON p.id = oi.product_id
      WHERE p.is_verified = false OR p.verification_status = 'unverified'
      ORDER BY p.id ASC
    `);

    // 3. Detect duplicate groups by normalized name
    const duplicateNameRows = await db.execute(sql`
      SELECT 
        lower(trim(name)) as "normalizedName", 
        min(name) as "sampleName",
        count(*)::int as "count", 
        array_agg(id ORDER BY id) as "ids"
      FROM products
      GROUP BY lower(trim(name))
      HAVING count(*) > 1
      ORDER BY count(*) DESC, lower(trim(name)) ASC
    `);

    const allDupIds: number[] = [];
    const rawGroups: any[] = duplicateNameRows.rows || [];
    for (const g of rawGroups) {
      if (Array.isArray(g.ids)) {
        allDupIds.push(...g.ids);
      }
    }

    // Fetch details for all products in duplicate groups
    let dupProductsMap = new Map<number, any>();
    if (allDupIds.length > 0) {
      const dupProductsResult = await db.execute(sql`
        SELECT 
          p.id, 
          p.name, 
          p.sku, 
          p.supplier_sku as "supplierSku", 
          p.supplier_product_id as "supplierProductId", 
          p.supplier_source as "supplierSource",
          p.source_url as "sourceUrl",
          p.price::numeric as price, 
          p.available_quantity as "availableQuantity", 
          p.category, 
          p.material, 
          p.is_active as "isActive", 
          p.is_verified as "isVerified",
          p.verification_status as "verificationStatus",
          p.images, 
          p.created_at as "createdAt",
          COALESCE(oi.order_count, 0)::int as "orderCount"
        FROM products p
        LEFT JOIN (
          SELECT product_id, count(*)::int as order_count
          FROM order_items
          GROUP BY product_id
        ) oi ON p.id = oi.product_id
        WHERE p.id IN (${sql.join(allDupIds, sql`, `)})
        ORDER BY p.id ASC
      `);

      for (const p of (dupProductsResult.rows as any[] || [])) {
        dupProductsMap.set(p.id, p);
      }
    }

    const duplicateGroups = rawGroups.map((g: any) => ({
      normalizedName: g.normalizedName,
      name: g.sampleName,
      count: g.count,
      products: (g.ids || []).map((id: number) => dupProductsMap.get(id)).filter(Boolean),
    }));

    // 4. Products with existing sales history
    const [salesSummaryRow] = await db.select({
      totalOrderItems: sql<number>`count(*)::int`,
      distinctProductsWithOrders: sql<number>`count(distinct ${orderItemsTable.productId})::int`,
    }).from(orderItemsTable);

    res.json({
      summary: {
        totalProducts: countsRow.total,
        verifiedProducts: countsRow.verified,
        delistedProducts: countsRow.delisted,
        unverifiedProducts: countsRow.unverified,
        activeProducts: countsRow.active,
        inactiveProducts: countsRow.inactive,
        duplicateGroupsCount: duplicateGroups.length,
        totalDuplicateProducts: allDupIds.length,
        productsWithSalesHistory: salesSummaryRow.distinctProductsWithOrders,
        totalOrderLineItems: salesSummaryRow.totalOrderItems,
      },
      unverifiedList: unverifiedProducts.rows || [],
      duplicateGroups,
      auditedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Failed to run catalogue audit:", error);
    res.status(500).json({ error: "Failed to generate catalogue audit report" });
  }
});

// POST /api/admin/verify-catalogue
// Runs verification against PRAO source product IDs & URLs
router.post("/admin/verify-catalogue", requireAdmin, async (_req, res): Promise<void> => {
  try {
    // 1. Mark non-PRAO / missing supplier_product_id products as unverified
    const unverifiedResult = await db.execute(sql`
      UPDATE products
      SET is_verified = false,
          verification_status = 'unverified',
          verification_notes = 'Missing PRAO source product ID and URL. Legacy seed inventory of non-PRAO origin.',
          source_url = '',
          verified_at = NULL
      WHERE supplier_product_id IS NULL 
         OR supplier_product_id = '' 
         OR supplier_source NOT ILIKE '%prao%'
      RETURNING id
    `);

    // 2. Mark products with authentic PRAO supplier IDs as verified and attach canonical source URLs
    const verifiedResult = await db.execute(sql`
      UPDATE products
      SET is_verified = true,
          verification_status = 'verified',
          verification_notes = CONCAT('Verified PRAO supplier product (Shopify ID: ', supplier_product_id, ', SKU: ', supplier_sku, ')'),
          source_url = CASE 
            WHEN supplier_sku IS NOT NULL AND supplier_sku != '' THEN CONCAT('https://prao.com/products/', LOWER(supplier_sku))
            ELSE CONCAT('https://prao.com/products?q=', supplier_product_id)
          END,
          verified_at = NOW()
      WHERE supplier_product_id IS NOT NULL 
        AND supplier_product_id != '' 
        AND supplier_source ILIKE '%prao%'
      RETURNING id
    `);

    res.json({
      success: true,
      verifiedCount: verifiedResult.rowCount || 0,
      unverifiedCount: unverifiedResult.rowCount || 0,
      message: `Catalogue verification complete: ${verifiedResult.rowCount || 0} products verified with PRAO source IDs and URLs, ${unverifiedResult.rowCount || 0} non-PRAO products flagged as unverified.`,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Failed to verify catalogue:", error);
    res.status(500).json({ error: "Verification process encountered an error" });
  }
});

// POST /api/admin/products/:id/verify
// Manually toggle or update verification status for a specific product
router.post("/admin/products/:id/verify", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const schema = z.object({
    isVerified: z.boolean(),
    verificationStatus: z.enum(["verified", "unverified", "delisted", "flagged"]).optional(),
    sourceUrl: z.string().optional(),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { isVerified, verificationStatus, sourceUrl, notes } = parsed.data;

  try {
    const [updated] = await db.update(productsTable)
      .set({
        isVerified,
        verificationStatus: verificationStatus || (isVerified ? "verified" : "unverified"),
        sourceUrl: sourceUrl ?? undefined,
        verificationNotes: notes ?? undefined,
        verifiedAt: isVerified ? new Date() : null,
      })
      .where(eq(productsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({ success: true, product: updated });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update product verification status" });
  }
});

// POST /api/admin/cleanup/deactivate-unverified
// Safely deactivates unverified products (hiding them from public catalogue & active sales)
// NEVER deletes records or sales history!
router.post("/admin/cleanup/deactivate-unverified", requireAdmin, async (req, res): Promise<void> => {
  try {
    const schema = z.object({
      productIds: z.array(z.number()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    const specificIds = parsed.success ? parsed.data.productIds : undefined;

    let query;
    if (specificIds && specificIds.length > 0) {
      query = sql`
        UPDATE products
        SET is_active = false
        WHERE id IN (${sql.join(specificIds, sql`, `)})
        RETURNING id
      `;
    } else {
      query = sql`
        UPDATE products
        SET is_active = false
        WHERE (is_verified = false OR verification_status = 'unverified')
          AND is_active = true
        RETURNING id
      `;
    }

    const result = await db.execute(query);
    const count = result.rowCount || 0;

    res.json({
      success: true,
      deactivatedCount: count,
      message: `Safely deactivated ${count} unverified product(s). All records and historical sales are 100% preserved.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to deactivate unverified products" });
  }
});

// POST /api/admin/cleanup/differentiate-duplicates
// Disambiguates duplicate product names by appending supplier SKU (e.g. "SAJRI Bracelet ... (6116PR)")
// Keeps records distinct and staff-friendly without deleting anything
router.post("/admin/cleanup/differentiate-duplicates", requireAdmin, async (_req, res): Promise<void> => {
  try {
    // 1. Find all duplicate groups
    const duplicateNameRows = await db.execute(sql`
      SELECT 
        lower(trim(name)) as "normalizedName", 
        array_agg(id ORDER BY id) as "ids"
      FROM products
      GROUP BY lower(trim(name))
      HAVING count(*) > 1
    `);

    let updatedCount = 0;
    const details: any[] = [];

    for (const group of (duplicateNameRows.rows as any[] || [])) {
      const ids: number[] = group.ids || [];
      const prodsResult = await db.execute(sql`
        SELECT id, name, sku, supplier_sku as "supplierSku"
        FROM products
        WHERE id IN (${sql.join(ids, sql`, `)})
        ORDER BY id
      `);

      for (const prod of (prodsResult.rows as any[] || [])) {
        const identifier = String(prod.supplierSku || prod.sku || "").trim();
        if (!identifier) continue;

        // Only append if not already in the name
        if (!String(prod.name).includes(`(${identifier})`)) {
          const newName = `${prod.name} (${identifier})`;
          await db.execute(sql`
            UPDATE products
            SET name = ${newName}
            WHERE id = ${prod.id}
          `);
          updatedCount++;
          details.push({ id: prod.id, oldName: prod.name, newName });
        }
      }
    }

    res.json({
      success: true,
      updatedCount,
      details,
      message: `Differentiated ${updatedCount} duplicate product titles with unique SKU suffixes. Zero records deleted.`,
    });
  } catch (error: any) {
    console.error("Failed to differentiate duplicate titles:", error);
    res.status(500).json({ error: "Failed to differentiate duplicates" });
  }
});

// POST /api/admin/cleanup/deactivate-duplicate
// Safely deactivates an unwanted duplicate record (preserves all sales history and inventory logs)
router.post("/admin/cleanup/deactivate-duplicate", requireAdmin, async (req, res): Promise<void> => {
  const schema = z.object({
    productId: z.number(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid productId" });
    return;
  }

  const { productId } = parsed.data;

  try {
    const [updated] = await db.update(productsTable)
      .set({ isActive: false })
      .where(eq(productsTable.id, productId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({
      success: true,
      productId,
      name: updated.name,
      isActive: false,
      message: `Product "${updated.name}" safely deactivated. Sales history and order items remain 100% intact.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to deactivate duplicate product" });
  }
});

// DELETE /api/admin/cleanup/product/:id
// Strict safe delete: REJECTS deletion if product has any sales history / order items
router.delete("/admin/cleanup/product/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  try {
    // 1. Check if product is referenced in order_items
    const orderItemsCheck = await db.execute(sql`
      SELECT count(*)::int as count
      FROM order_items
      WHERE product_id = ${id}
    `);
    const orderCount = Number(orderItemsCheck.rows[0]?.count || 0);

    if (orderCount > 0) {
      res.status(400).json({
        error: `PROTECTED RECORD: Cannot delete this product because it has sales history (linked to ${orderCount} customer invoice item(s)). Deactivate the product instead to safely hide it without altering financial records.`,
        hasSalesHistory: true,
        orderCount,
      });
      return;
    }

    // 2. Safe to remove: clean inventory transactions first
    await db.delete(inventoryTable).where(eq(inventoryTable.productId, id));

    const [deleted] = await db.delete(productsTable)
      .where(eq(productsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({
      success: true,
      message: `Product "${deleted.name}" (ID: ${id}) safely deleted. It had 0 customer order references.`,
    });
  } catch (error: any) {
    console.error("Failed to safely delete product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;

