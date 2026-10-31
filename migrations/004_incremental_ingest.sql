ALTER TABLE mh_snapshots ADD COLUMN IF NOT EXISTS ingest_revision integer NOT NULL DEFAULT 0;
ALTER TABLE mh_snapshots ADD COLUMN IF NOT EXISTS last_ingested_at timestamptz;
ALTER TABLE mh_jobs ADD COLUMN IF NOT EXISTS observed_at timestamptz;

CREATE TABLE IF NOT EXISTS mh_ingest_runs (
  id uuid PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES mh_snapshots(id),
  observed_at timestamptz NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  unchanged integer NOT NULL DEFAULT 0,
  stale integer NOT NULL DEFAULT 0,
  embedding_documents integer NOT NULL DEFAULT 0,
  embedding_tokens integer NOT NULL DEFAULT 0,
  expected_writes integer NOT NULL DEFAULT 0,
  written integer NOT NULL DEFAULT 0,
  CHECK (written = expected_writes)
);
CREATE INDEX IF NOT EXISTS mh_ingest_runs_catalog ON mh_ingest_runs(snapshot_id,committed_at);
