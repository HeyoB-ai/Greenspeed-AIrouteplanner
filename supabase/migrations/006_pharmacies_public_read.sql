-- Koeriers valideren hun koppelcode door de apotheek op te zoeken via
-- pharmacies."courierCode". Dat vereist SELECT-rechten op pharmacies.
-- Deze policy (gelijk aan de in-app setup-SQL) garandeert leestoegang.
-- Idempotent: veilig om opnieuw te draaien.
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON pharmacies;
CREATE POLICY "Allow public access" ON pharmacies FOR ALL USING (true);
