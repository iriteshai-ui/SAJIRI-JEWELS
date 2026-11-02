import { db } from "@workspace/db";
import { usersTable, productsTable, inventoryTable, metalRatesTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

export async function seedIfEmpty() {
  const [{ value: userCount }] = await db
    .select({ value: count() })
    .from(usersTable);

  if (Number(userCount) > 0) return;

  logger.info("No users found — seeding Rits Jewellers default data...");

  const adminPasswordHash = await bcrypt.hash("Rits@123", 10);

  const [adminUser] = await db
    .insert(usersTable)
    .values({
      name: "Rits Administrator",
      username: "admin",
      email: "admin@ritsjewellers.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      isActive: true,
    })
    .returning();

  // Initial metal rates
  try {
    await db.insert(metalRatesTable).values({
      gold24k: "7650.00",
      gold22k: "7010.00",
      gold18k: "5740.00",
      silver: "92.50",
      platinum: "3200.00",
      updatedById: adminUser.id,
    });
  } catch (e) {
    logger.warn({ error: e }, "Failed to seed metal rates table");
  }

  const sampleJewellery = [
    {
      name: "22K Antique Royal Bridal Necklace",
      category: "Necklaces",
      metalType: "Gold",
      purity: "22K 916",
      grossWeight: "48.500",
      netWeight: "45.200",
      stoneWeight: "3.300",
      makingChargesType: "per_gram",
      makingChargesValue: "550.00",
      hallmarkUid: "RJ7841",
      hsnCode: "7113",
      price: "341600.00",
      qty: 2,
      description: "Antique handcrafted bridal choker necklace with heritage kundan work and ruby accents. BIS Hallmarked 916 Gold.",
    },
    {
      name: "22K Traditional Temple Design Bangles (Pair)",
      category: "Bangles",
      metalType: "Gold",
      purity: "22K 916",
      grossWeight: "35.800",
      netWeight: "35.800",
      stoneWeight: "0.000",
      makingChargesType: "per_gram",
      makingChargesValue: "420.00",
      hallmarkUid: "RJ3920",
      hsnCode: "7113",
      price: "266000.00",
      qty: 4,
      description: "Intricately carved Laxmi-motif temple bangles in pure 22K yellow gold.",
    },
    {
      name: "18K Solitaire Diamond Ring (0.75 ct VVS-EF)",
      category: "Rings",
      metalType: "Diamond",
      purity: "18K 750",
      grossWeight: "4.800",
      netWeight: "4.650",
      stoneWeight: "0.150",
      makingChargesType: "fixed",
      makingChargesValue: "4500.00",
      hallmarkUid: "RJ1092",
      hsnCode: "7113",
      price: "115000.00",
      qty: 3,
      description: "Six-prong diamond solitaire engagement ring in 18K white gold with VVS clarity diamond.",
    },
    {
      name: "22K Royal Heritage Mangalsutra",
      category: "Mangalsutra",
      metalType: "Gold",
      purity: "22K 916",
      grossWeight: "21.400",
      netWeight: "18.200",
      stoneWeight: "3.200",
      makingChargesType: "per_gram",
      makingChargesValue: "480.00",
      hallmarkUid: "RJ4491",
      hsnCode: "7113",
      price: "136300.00",
      qty: 5,
      description: "Traditional double-strand black beads chain with handcrafted floral gold pendant.",
    },
    {
      name: "24K Pure Gold Laxmi-Ganesh Bar (10g)",
      category: "Coins",
      metalType: "Gold",
      purity: "24K 999",
      grossWeight: "10.000",
      netWeight: "10.000",
      stoneWeight: "0.000",
      makingChargesType: "fixed",
      makingChargesValue: "400.00",
      hallmarkUid: "RJ9901",
      hsnCode: "7113",
      price: "76900.00",
      qty: 15,
      description: "999.9 purity minted investment gold bar with tamper-proof blister pack.",
    },
    {
      name: "22K Men's Italian Link Gold Chain",
      category: "Chains",
      metalType: "Gold",
      purity: "22K 916",
      grossWeight: "28.250",
      netWeight: "28.250",
      stoneWeight: "0.000",
      makingChargesType: "per_gram",
      makingChargesValue: "380.00",
      hallmarkUid: "RJ5612",
      hsnCode: "7113",
      price: "208800.00",
      qty: 6,
      description: "Masculine Italian curb link design with secure lobster claw clasp.",
    },
    {
      name: "22K Peacock Jhumka Earrings",
      category: "Earrings",
      metalType: "Gold",
      purity: "22K 916",
      grossWeight: "14.600",
      netWeight: "13.900",
      stoneWeight: "0.700",
      makingChargesType: "per_gram",
      makingChargesValue: "520.00",
      hallmarkUid: "RJ2234",
      hsnCode: "7113",
      price: "104600.00",
      qty: 8,
      description: "Bell-shaped jhumkas adorned with filigree work and golden hanging pearls.",
    },
    {
      name: "925 Sterling Silver Antique Payal (Pair)",
      category: "Silverware",
      metalType: "Silver",
      purity: "925 Silver",
      grossWeight: "95.000",
      netWeight: "95.000",
      stoneWeight: "0.000",
      makingChargesType: "per_gram",
      makingChargesValue: "15.00",
      hallmarkUid: "RJ0012",
      hsnCode: "7113",
      price: "10210.00",
      qty: 10,
      description: "Traditional silver anklets with tinkling bells in 92.5% sterling silver.",
    },
  ];

  for (const item of sampleJewellery) {
    const [inserted] = await db
      .insert(productsTable)
      .values({
        name: item.name,
        category: item.category,
        metalType: item.metalType,
        purity: item.purity,
        grossWeight: item.grossWeight,
        netWeight: item.netWeight,
        stoneWeight: item.stoneWeight,
        makingChargesType: item.makingChargesType,
        makingChargesValue: item.makingChargesValue,
        hallmarkUid: item.hallmarkUid,
        hsnCode: item.hsnCode,
        price: item.price,
        description: item.description,
        availableQuantity: item.qty,
      })
      .returning();

    await db.insert(inventoryTable).values({
      productId: inserted.id,
      productName: inserted.name,
      previousQuantity: 0,
      quantityAdded: item.qty,
      quantityReduced: 0,
      currentQuantity: item.qty,
      actionType: "add",
      updatedById: adminUser.id,
    });
  }

  logger.info("Startup seeding complete: Rits Jewellers admin and inventory ready.");
}
