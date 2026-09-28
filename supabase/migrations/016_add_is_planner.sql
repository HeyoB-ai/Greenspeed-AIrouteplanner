BEGIN;

ALTER TABLE user_profiles
  ADD COLUMN is_planner BOOLEAN NOT NULL DEFAULT FALSE;

-- Bestaande planner-users krijgen de vlag
UPDATE user_profiles SET is_planner = TRUE WHERE role = 'planner';

-- Trigger: is_planner volgt mee als role wijzigt
CREATE OR REPLACE FUNCTION sync_is_planner()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Role wordt planner → zet vlag
  IF NEW.role = 'planner' AND OLD.role IS DISTINCT FROM 'planner' THEN
    NEW.is_planner := TRUE;
  END IF;
  -- Role gaat weg van planner → wis vlag (alleen als niet expliciet anders gezet)
  IF OLD.role = 'planner' AND NEW.role IS DISTINCT FROM 'planner'
     AND NEW.is_planner = OLD.is_planner THEN
    NEW.is_planner := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_is_planner
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION sync_is_planner();

COMMIT;
