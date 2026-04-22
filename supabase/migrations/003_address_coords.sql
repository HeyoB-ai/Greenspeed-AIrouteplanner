ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS "addressLat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "addressLng" DOUBLE PRECISION;

COMMENT ON COLUMN packages."addressLat" IS 'GPS latitude van het bezorgadres (gecached bij inscannen)';
COMMENT ON COLUMN packages."addressLng" IS 'GPS longitude van het bezorgadres (gecached bij inscannen)';
