-- 004_add_product_image_and_sku.sql
-- Add image_url, sku, category, and base_price columns to products table

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" varchar(100);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category" varchar(100) DEFAULT 'KOPI';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "base_price" double precision DEFAULT 0;

-- Backfill default SKU & category for existing seeded products if null
UPDATE "products" 
SET 
  sku = 'COZ-PROD-' || LPAD(SUBSTRING(id::text, 1, 4), 4, '0'),
  category = CASE 
    WHEN name ILIKE '%kopi%' OR name ILIKE '%coffee%' OR name ILIKE '%americano%' OR name ILIKE '%espresso%' OR name ILIKE '%latte%' THEN 'KOPI'
    WHEN name ILIKE '%matcha%' OR name ILIKE '%tea%' OR name ILIKE '%choco%' OR name ILIKE '%susu%' THEN 'NON_KOPI'
    ELSE 'MAKANAN'
  END,
  base_price = ROUND((price * 0.6)::numeric, 2)
WHERE sku IS NULL OR base_price IS NULL OR base_price = 0;
