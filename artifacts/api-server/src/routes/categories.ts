import { Router } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { eq, asc, sql, and } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  parentId: z.number().nullable().optional(),
  description: z.string().optional().default(""),
  icon: z.string().optional().default("Sparkles"),
  displayOrder: z.number().optional().default(0),
});

const updateCategorySchema = createCategorySchema.partial();

// GET /api/categories (Public & Authenticated)
router.get("/categories", async (_req, res): Promise<void> => {
  try {
    const categories = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        parentId: categoriesTable.parentId,
        description: categoriesTable.description,
        icon: categoriesTable.icon,
        displayOrder: categoriesTable.displayOrder,
        isActive: categoriesTable.isActive,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.isActive, true))
      .orderBy(asc(categoriesTable.displayOrder), asc(categoriesTable.name));

    // Also get product count per category
    const counts = await db
      .select({
        category: productsTable.category,
        count: sql<number>`count(*)::int`,
      })
      .from(productsTable)
      .where(and(eq(productsTable.isActive, true), eq(productsTable.isVerified, true)))
      .groupBy(productsTable.category);

    const countMap = new Map(counts.map(c => [c.category?.toLowerCase(), c.count]));

    const enriched = categories.map(cat => ({
      ...cat,
      productCount: countMap.get(cat.name.toLowerCase()) || countMap.get(cat.slug.toLowerCase()) || 0,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/categories (Admin only)
router.post("/categories", requireAdmin, async (req, res): Promise<void> => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, slug, parentId, description, icon, displayOrder } = parsed.data;

  try {
    const [created] = await db
      .insert(categoriesTable)
      .values({
        name,
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        parentId: parentId ?? null,
        description: description ?? "",
        icon: icon ?? "Sparkles",
        displayOrder: displayOrder ?? 0,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Category slug already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PATCH /api/categories/:id (Admin only)
router.patch("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(categoriesTable)
    .set(parsed.data)
    .where(eq(categoriesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.json(updated);
});

// DELETE /api/categories/:id (Admin only)
router.delete("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.sendStatus(204);
});

export default router;
