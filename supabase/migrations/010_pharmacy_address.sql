-- 010_pharmacy_address.sql — gestructureerde adresvelden op apotheken
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS "street"      TEXT,
  ADD COLUMN IF NOT EXISTS "houseNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode"  TEXT,
  ADD COLUMN IF NOT EXISTS "city"        TEXT;
