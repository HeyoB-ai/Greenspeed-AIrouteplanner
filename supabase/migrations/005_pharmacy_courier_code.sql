-- Permanente koppelcode per apotheek waarmee koeriers zich koppelen.
-- Vervangt het tijdelijke pharmacy_codes-model (dat blijft als fallback bestaan).
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS "courierCode" TEXT;

-- Eén code mag maar bij één apotheek horen (anders is login dubbelzinnig).
CREATE UNIQUE INDEX IF NOT EXISTS pharmacies_couriercode_unique
  ON pharmacies ("courierCode")
  WHERE "courierCode" IS NOT NULL;
