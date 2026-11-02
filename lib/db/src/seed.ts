import { db } from "./index";
import { usersTable, productsTable, inventoryTable, metalRatesTable } from "./schema";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding Rits Jewellers database...");

  // 1. Create Default Admin User
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

  console.log(`Created admin user: admin / Rits@123 (ID: ${adminUser.id})`);

  // 2. Seed Live Metal Rates
  await db.insert(metalRatesTable).values({
    gold24k: "7650.00",
    gold22k: "7010.00",
    gold18k: "5740.00",
    silver: "92.50",
    platinum: "3200.00",
    updatedById: adminUser.id,
  });
  console.log("Seeded initial metal rates (Gold 24K: ₹7,650, 22K: ₹7,010, Silver: ₹92.50).");

  // 3. Create Sample Jewelry Products
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
      description: "Exquisite antique handcrafted bridal choker necklace with heritage kundan work and ruby stone accents. 100% BIS Hallmarked 916 Gold.",
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
      description: "Intricately carved Laxmi-motif temple bangles in pure 22K yellow gold. Standard size 2.6.",
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
      description: "Stunning six-prong diamond solitaire engagement ring crafted in 18K white gold with IGI certified VVS clarity diamond.",
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
      description: "Traditional auspicious double-strand black beads chain with handcrafted floral gold pendant.",
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
      description: "NABL certified 999.9 purity minted investment gold bar with tamper-proof blister packaging.",
    },
    {
      name: "24K Pure Gold Coin (5g)",
      category: "Coins",
      metalType: "Gold",
      purity: "24K 999",
      grossWeight: "5.000",
      netWeight: "5.000",
      stoneWeight: "0.000",
      makingChargesType: "fixed",
      makingChargesValue: "250.00",
      hallmarkUid: "RJ9902",
      hsnCode: "7113",
      price: "38500.00",
      qty: 20,
      description: "99.9% 24K Swiss minted gold coin featuring embossed goddess motif for auspicious gifting.",
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
      description: "Robust 22-inch masculine Italian curb link design with secure lobster claw clasp.",
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
      description: "Graceful bell-shaped jhumkas adorned with delicate filigree work, dangling golden pearls, and ruby doublet stones.",
    },
    {
      name: "18K Rose Gold Diamond Tennis Bracelet",
      category: "Bracelets",
      metalType: "Diamond",
      purity: "18K 750",
      grossWeight: "16.500",
      netWeight: "15.100",
      stoneWeight: "1.400",
      makingChargesType: "fixed",
      makingChargesValue: "8000.00",
      hallmarkUid: "RJ8830",
      hsnCode: "7113",
      price: "285000.00",
      qty: 2,
      description: "Timeless luxury tennis bracelet featuring 42 round brilliant diamonds set in lustrous 18K rose gold.",
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
      description: "Traditional silver anklets with tinkling ghungroo bells in high-purity 92.5% sterling silver.",
    },
    {
      name: "999 Pure Silver Pooja Thali Set (6 Pcs)",
      category: "Silverware",
      metalType: "Silver",
      purity: "999 Silver",
      grossWeight: "350.000",
      netWeight: "350.000",
      stoneWeight: "0.000",
      makingChargesType: "per_gram",
      makingChargesValue: "12.00",
      hallmarkUid: "RJ0045",
      hsnCode: "7113",
      price: "36575.00",
      qty: 5,
      description: "Full ceremonial pure silver thali set including thali, diya, agarbatti stand, ghanti, chandan katori, and spoon.",
    },
    {
      name: "22K Floral Diamond Cut Gold Kada",
      category: "Bangles",
      metalType: "Gold",
      purity: "22K 916",
      grossWeight: "25.000",
      netWeight: "25.000",
      stoneWeight: "0.000",
      makingChargesType: "per_gram",
      makingChargesValue: "400.00",
      hallmarkUid: "RJ3311",
      hsnCode: "7113",
      price: "185250.00",
      qty: 4,
      description: "Modern openable single kada with sharp diamond-cut facets that catch the light from every angle.",
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

    // Inventory Transaction logs
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

  console.log(`Successfully seeded ${sampleJewellery.length} jewelry inventory items.`);
  console.log("Rits Jewellers seed complete!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding database:", err);
    process.exit(1);
  });
