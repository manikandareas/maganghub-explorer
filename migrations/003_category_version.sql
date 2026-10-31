ALTER TABLE mh_snapshots ADD COLUMN IF NOT EXISTS taxonomy_version integer NOT NULL DEFAULT 1 CHECK (taxonomy_version > 0);
