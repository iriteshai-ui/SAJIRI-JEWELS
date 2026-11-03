-- Migration 003: Add Product Verification & Source Tracking
-- ============================================================================

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_url" TEXT DEFAULT '';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "verification_notes" TEXT DEFAULT '';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ;

-- Performance indexes for catalogue querying & verification lookups
CREATE INDEX IF NOT EXISTS "idx_products_is_verified_is_active" ON "products" ("is_verified", "is_active");
CREATE INDEX IF NOT EXISTS "idx_products_supplier_product_id" ON "products" ("supplier_product_id");
CREATE INDEX IF NOT EXISTS "idx_products_verification_status" ON "products" ("verification_status");

