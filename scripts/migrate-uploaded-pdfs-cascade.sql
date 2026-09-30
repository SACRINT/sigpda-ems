-- =========================================================
-- H-289: Migración FK uploaded_pdfs.planning_id a ON DELETE CASCADE
-- =========================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Localizar y remover cualquier constraint existente sobre planning_id
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'uploaded_pdfs'
          AND kcu.column_name = 'planning_id'
    ) LOOP
        EXECUTE 'ALTER TABLE uploaded_pdfs DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;

    -- Recrear constraint con ON DELETE CASCADE
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uploaded_pdfs') THEN
        ALTER TABLE uploaded_pdfs
            ADD CONSTRAINT uploaded_pdfs_planning_id_fkey
            FOREIGN KEY (planning_id) REFERENCES plannings(id) ON DELETE CASCADE;
    END IF;
END $$;
