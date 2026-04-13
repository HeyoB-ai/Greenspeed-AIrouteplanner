-- ════════════════════════════════════════
-- Greenspeed Auth System — migratie 002
-- Voer uit in Supabase SQL Editor
-- ════════════════════════════════════════
-- Database trigger die automatisch een user_profiles record aanmaakt
-- zodra een nieuwe auth.users rij wordt ingevoegd.
-- Dit omzeilt het RLS-probleem bij signUp vóór e-mailbevestiging.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Alleen aanmaken als er metadata is met een rol
  IF new.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, name, role, pharmacy_ids)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'name', new.email),
      new.raw_user_meta_data->>'role',
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'pharmacy_ids')),
        '{}'::TEXT[]
      )
    )
    ON CONFLICT (id) DO NOTHING;  -- idempotent bij herhaalde aanroep
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verwijder bestaande trigger als die al bestaat
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
