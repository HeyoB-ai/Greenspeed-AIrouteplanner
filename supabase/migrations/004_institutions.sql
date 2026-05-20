CREATE TABLE IF NOT EXISTS institutions (
  id           TEXT PRIMARY KEY,
  "pharmacyId" TEXT NOT NULL REFERENCES pharmacies(id),
  name         TEXT NOT NULL,
  address      TEXT NOT NULL,
  street       TEXT,
  "houseNumber" TEXT,
  "postalCode"  TEXT,
  city         TEXT,
  "addressLat" DOUBLE PRECISION,
  "addressLng" DOUBLE PRECISION,
  frequency    TEXT DEFAULT 'weekly',
  "deliveryDays" TEXT[] DEFAULT '{}',
  instructions TEXT,
  "contactPerson" TEXT,
  "contactPhone"  TEXT,
  "isActive"   BOOLEAN DEFAULT true,
  "createdAt"  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON institutions;
CREATE POLICY "Allow public access" ON institutions
  FOR ALL USING (true);
