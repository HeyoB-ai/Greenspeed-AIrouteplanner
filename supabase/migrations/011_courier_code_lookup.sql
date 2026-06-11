-- 011_courier_code_lookup.sql — pre-login apotheek-lookup op koppelcode via SECURITY DEFINER
--
-- Golf 1b sluit pharmacies/pharmacy_codes af voor anonieme SELECT. De koerier
-- koppelt zich vóór login met een code; die lookup moet dus zonder sessie werken.
-- Deze functie draait met de rechten van de eigenaar (omzeilt RLS) en geeft
-- uitsluitend het apotheek-id terug dat bij de meegegeven code hoort — niets meer.
-- Prioriteit: permanente pharmacies."courierCode", anders tijdelijke pharmacy_codes.

CREATE OR REPLACE FUNCTION public.lookup_pharmacy_by_code(p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm TEXT := upper(trim(p_code));
  v_id   TEXT;
BEGIN
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Permanente koppelcode op de apotheek (hoofdletter-ongevoelig)
  SELECT id INTO v_id
    FROM public.pharmacies
   WHERE upper(trim("courierCode")) = v_norm
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- 2. Fallback: tijdelijke, verlopende code in pharmacy_codes
  SELECT pharmacy_id INTO v_id
    FROM public.pharmacy_codes
   WHERE upper(trim(code)) = v_norm
     AND expires_at > now()
   LIMIT 1;

  RETURN v_id;
END;
$$;

-- Uitvoerbaar voor anonieme (pre-login) én ingelogde gebruikers
GRANT EXECUTE ON FUNCTION public.lookup_pharmacy_by_code(TEXT) TO anon, authenticated;
