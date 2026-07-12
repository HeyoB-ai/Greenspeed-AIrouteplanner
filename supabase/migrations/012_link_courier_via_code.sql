-- 012_link_courier_via_code.sql — koerier koppelen op de permanente apotheekcode
--
-- De koppelcode van een apotheek staat in pharmacies."courierCode" (permanent,
-- vervangen = nieuwe code genereren). De legacy tabel pharmacy_codes (24u-expiry)
-- speelt geen rol meer in dit pad.
--
-- Deze SECURITY DEFINER-functie doet de match én de koppeling server-side, zodat
-- een koerier zich kan koppelen zonder SELECT-rechten op de volledige pharmacies-
-- tabel. Ze vereist een echte sessie: zonder auth.uid() volgt status 'no_session'.

CREATE OR REPLACE FUNCTION public.link_courier_via_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_norm TEXT := upper(trim(coalesce(p_code, '')));
  v_id   TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'no_session');
  END IF;

  IF v_norm = '' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT id::TEXT INTO v_id
    FROM public.pharmacies
   WHERE upper(trim("courierCode")) = v_norm
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  INSERT INTO public.courier_pharmacy_access (courier_id, pharmacy_id)
  VALUES (v_uid, v_id)
  ON CONFLICT (courier_id, pharmacy_id) DO NOTHING;

  RETURN jsonb_build_object('status', 'ok', 'pharmacy_id', v_id);
END;
$$;

REVOKE ALL   ON FUNCTION public.link_courier_via_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_courier_via_code(TEXT) TO authenticated;

-- Oude lookup uit 011 verdwijnt: die viel terug op pharmacy_codes, gaf het
-- apotheek-id al vóór login prijs en wordt door de app niet meer aangeroepen.
-- De tabel pharmacy_codes zelf blijft staan (aparte opruimstap).
DROP FUNCTION IF EXISTS public.lookup_pharmacy_by_code(TEXT);
