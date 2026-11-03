import { Router } from "express";
import { db, metalRatesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAuth, requireAdmin, getSessionUser } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const updateRatesSchema = z.object({
  gold24k: z.number().positive(),
  gold22k: z.number().positive(),
  gold18k: z.number().positive(),
  silver: z.number().positive(),
  platinum: z.number().positive().optional(),
});

// GET /api/metal-rates - returns latest rates
router.get("/metal-rates", requireAuth, async (_req, res): Promise<void> => {
  try {
    const [latest] = await db
      .select()
      .from(metalRatesTable)
      .orderBy(desc(metalRatesTable.id))
      .limit(1);

    if (!latest) {
      // Default fallback rates
      res.json({
        gold24k: 7650.0,
        gold22k: 7010.0,
        gold18k: 5740.0,
        silver: 92.5,
        platinum: 3200.0,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    res.json({
      id: latest.id,
      gold24k: Number(latest.gold24k),
      gold22k: Number(latest.gold22k),
      gold18k: Number(latest.gold18k),
      silver: Number(latest.silver),
      platinum: Number(latest.platinum),
      updatedAt: latest.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metal rates" });
  }
});

// POST /api/metal-rates - update daily rates (admin or authorized staff)
router.post("/metal-rates", requireAdmin, async (req, res): Promise<void> => {
  const parsed = updateRatesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getSessionUser(req);
  const { gold24k, gold22k, gold18k, silver, platinum } = parsed.data;

  try {
    const [created] = await db
      .insert(metalRatesTable)
      .values({
        gold24k: String(gold24k),
        gold22k: String(gold22k),
        gold18k: String(gold18k),
        silver: String(silver),
        platinum: String(platinum ?? 3200),
        updatedById: user?.id,
      })
      .returning();

    res.json({
      id: created.id,
      gold24k: Number(created.gold24k),
      gold22k: Number(created.gold22k),
      gold18k: Number(created.gold18k),
      silver: Number(created.silver),
      platinum: Number(created.platinum),
      updatedAt: created.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update metal rates" });
  }
});

export default router;
