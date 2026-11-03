import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

// Load .env
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../.env"),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      if (process.env.DATABASE_URL) break;
    } catch (_) {}
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Category mapping helper
function mapToCategory(type: string = "", tags: string[] = []): string {
  const combined = `${type} ${tags.join(" ")}`.toLowerCase();
  if (combined.includes("earring") || combined.includes("jhumka") || combined.includes("stud") || combined.includes("bali") || combined.includes("hoop")) {
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
  if (combined.includes("set")) {
    return "Jewellery Sets";
  }
  return "Necklaces";
}

// Clean title: transforms "PRAO" into "SAJRI"
function cleanTitle(rawTitle: string): string {
  let title = (rawTitle || "").replace(/\bprao\b/gi, "SAJRI").trim();
  if (!/^sajri\b/i.test(title)) {
    title = `SAJRI ${title}`;
  }
  return title
    .replace(/\banti-tarnish\b/gi, "Anti-Tarnish")
    .replace(/\s+/g, " ")
    .trim();
}

// Clean description: transforms "PRAO" into "SAJRI"
function cleanDescription(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/\bprao\b/gi, "SAJRI")
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1")
    .trim();
}

function inferMaterial(title: string, tags: string[] = []): string {
  const combined = `${title} ${tags.join(" ")}`.toLowerCase();
  if (combined.includes("anti-tarnish") || combined.includes("stainless steel")) {
    return "Anti-Tarnish Stainless Steel (Waterproof & Hypoallergenic)";
  }
  if (combined.includes("18k") || combined.includes("gold plated")) {
    return "18K Gold Plated Brass";
  }
  if (combined.includes("silver") || combined.includes("925")) {
    return "925 Sterling Silver Plated";
  }
  return "Premium Anti-Tarnish Jewellery Alloy";
}

async function fetchPage(page: number, limit = 100, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://prao.com/products.json?limit=${limit}&page=${page}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 4;
        console.log(`Page ${page}: 429 Rate limit. Waiting ${retryAfter}s... (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!res.ok) {
        console.error(`Page ${page} failed with ${res.status}`);
        return null;
      }

      const data = (await res.json()) as any;
      return data.products || [];
    } catch (e: any) {
      console.error(`Page ${page} error:`, e.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

async function main() {
  const client = await pool.connect();
  console.log("Connected to Supabase PostgreSQL.");

  try {
    // 1. Update existing products in DB so PRAO -> SAJRI
    console.log("Updating existing products to have SAJRI in their titles...");
    const existingRows = await client.query(`SELECT id, name, description FROM products`);
    let updatedCount = 0;
    for (const row of existingRows.rows) {
      let newName = row.name.replace(/\bprao\b/gi, "SAJRI");
      if (!/^sajri\b/i.test(newName)) {
        newName = `SAJRI ${newName}`;
      }
      newName = newName.replace(/\s+/g, " ").trim();

      const newDesc = cleanDescription(row.description);
      if (newName !== row.name || newDesc !== row.description) {
        await client.query(`UPDATE products SET name = $1, description = $2 WHERE id = $3`, [
          newName,
          newDesc,
          row.id,
        ]);
        updatedCount++;
      }
    }
    console.log(`Updated ${updatedCount} existing products to SAJRI.`);

    // 2. Fetch category mappings
    const catRes = await client.query(`SELECT id, name FROM categories`);
    const categoryMap = new Map();
    for (const c of catRes.rows) {
      categoryMap.set(c.name.toLowerCase(), c.id);
    }

    // Default admin user for audit log
    const userRes = await client.query(`SELECT id FROM users LIMIT 1`);
    const adminId = userRes.rows[0]?.id || 1;

    // Check existing supplier product IDs
    const existingIdsRes = await client.query(`SELECT supplier_product_id FROM products WHERE supplier_product_id IS NOT NULL`);
    const existingIds = new Set(existingIdsRes.rows.map((r) => String(r.supplier_product_id)));

    console.log(`Found ${existingIds.size} already imported supplier products. Starting full PRAO import...`);

    let page = 1;
    let totalImported = 0;

    while (true) {
      console.log(`Fetching page ${page} from https://prao.com/...`);
      const rawProducts = await fetchPage(page, 100);

      if (!rawProducts || rawProducts.length === 0) {
        console.log(`No more products on page ${page}. Finished fetching.`);
        break;
      }

      console.log(`Page ${page}: processing ${rawProducts.length} items...`);

      for (const p of rawProducts) {
        const sourceId = String(p.id);
        if (existingIds.has(sourceId)) {
          // Already imported, skip
          continue;
        }

        const primaryVariant = p.variants?.[0] || {};
        const wholesaleCost = Number(primaryVariant.price || 0);
        const comparePrice = Number(primaryVariant.compare_at_price || 0);

        // Smart Retail Price with ~3x markup
        let retailPrice = comparePrice > wholesaleCost ? comparePrice : Math.round(wholesaleCost * 3.5);
        if (retailPrice < 499) retailPrice = 499;

        const compareAtPrice = Math.round(retailPrice * 1.3);

        const name = cleanTitle(p.title);
        const description = cleanDescription(p.body_html);
        const catName = mapToCategory(p.product_type, p.tags);
        const categoryId = categoryMap.get(catName.toLowerCase()) || null;
        const material = inferMaterial(p.title, p.tags);
        const color = p.options?.find((o: any) => o.name?.toUpperCase() === "COLOR")?.values?.[0] || primaryVariant.title || "Gold";
        const sku = `SJ-${p.id}`;
        const images = (p.images || []).map((img: any) => img.src);
        const initialQty = 5;

        const insertRes = await client.query(
          `INSERT INTO products (
            name, description, price, compare_at_price, available_quantity,
            sku, category_id, category, subcategory, material, color,
            style, design, images, supplier_cost, supplier_source,
            supplier_product_id, supplier_sku, is_featured, is_active
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20
          ) RETURNING id`,
          [
            name,
            description,
            retailPrice,
            compareAtPrice,
            initialQty,
            sku,
            categoryId,
            catName,
            "",
            material,
            color,
            "Contemporary",
            "Modern",
            JSON.stringify(images),
            wholesaleCost,
            "prao.com",
            sourceId,
            primaryVariant.sku || "",
            totalImported < 12, // feature the first dozen items
            true,
          ]
        );

        const newProductId = insertRes.rows[0].id;

        // Inventory transaction
        await client.query(
          `INSERT INTO inventory_transactions (
            product_id, product_name, previous_quantity, quantity_added,
            quantity_reduced, current_quantity, action_type, updated_by_id
          ) VALUES ($1, $2, 0, $3, 0, $3, 'import', $4)`,
          [newProductId, name, initialQty, adminId]
        );

        existingIds.add(sourceId);
        totalImported++;
      }

      console.log(`Page ${page} imported. Total new items imported so far: ${totalImported}`);

      if (rawProducts.length < 100) {
        console.log("Reached final page.");
        break;
      }

      page++;
      // Wait 1.5s between pages to prevent rate limits
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`\n🎉 Full Import Complete! Total new products imported: ${totalImported}`);

    // Total products in DB now:
    const countRes = await client.query(`SELECT count(*) FROM products`);
    console.log(`Total active products in SAJIRI JEWELS catalogue: ${countRes.rows[0].count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
