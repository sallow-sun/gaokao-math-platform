-- The earliest account is the permanent platform administrator.
UPDATE users
SET role = 'ADMIN', status = 'ACTIVE'
WHERE id = (SELECT MIN(id) FROM users);

CREATE OR REPLACE FUNCTION protect_permanent_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (SELECT 1 FROM users) THEN
            NEW.role := 'ADMIN';
            NEW.status := 'ACTIVE';
        END IF;
        RETURN NEW;
    END IF;

    IF OLD.id = (SELECT MIN(id) FROM users) THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'the first user is the permanent administrator and cannot be deleted';
        END IF;

        IF NEW.role <> 'ADMIN' OR NEW.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'the first user must remain an active administrator';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_permanent_admin ON users;
CREATE TRIGGER trg_protect_permanent_admin
BEFORE INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION protect_permanent_admin();
