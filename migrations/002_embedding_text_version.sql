ALTER TABLE mh_snapshots ADD COLUMN IF NOT EXISTS embedding_text_version integer NOT NULL DEFAULT 1 CHECK (embedding_text_version > 0);
ALTER TABLE mh_embeddings ADD COLUMN IF NOT EXISTS embedding_text_version integer NOT NULL DEFAULT 1 CHECK (embedding_text_version > 0);
