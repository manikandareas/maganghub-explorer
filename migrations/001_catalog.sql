CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS mh_snapshots (
  id text PRIMARY KEY,
  source_hash text NOT NULL,
  snapshot_date date NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  expected_count integer NOT NULL CHECK (expected_count > 0),
  facets jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  embedding_model text NOT NULL,
  embedding_dimensions integer NOT NULL CHECK (embedding_dimensions = 512)
);

CREATE TABLE IF NOT EXISTS mh_embeddings (
  hash text PRIMARY KEY,
  model text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions = 512),
  embedding vector(512) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_jobs (
  snapshot_id text NOT NULL REFERENCES mh_snapshots(id),
  id uuid NOT NULL,
  portal_order integer NOT NULL,
  az_order integer NOT NULL,
  payload jsonb NOT NULL,
  province_code integer NOT NULL,
  city_code integer NOT NULL,
  category text NOT NULL,
  organization_type integer NOT NULL,
  education_mask integer NOT NULL,
  interview_mask integer NOT NULL,
  disability boolean NOT NULL,
  quota integer NOT NULL,
  applicants integer NOT NULL,
  opportunity_score double precision NOT NULL,
  search_fields text[] NOT NULL CHECK (array_length(search_fields, 1) = 5),
  fts tsvector NOT NULL,
  embedding_text text NOT NULL,
  embedding_hash text NOT NULL,
  PRIMARY KEY (snapshot_id, id)
);
CREATE INDEX IF NOT EXISTS mh_jobs_fts ON mh_jobs USING gin (fts);
CREATE INDEX IF NOT EXISTS mh_jobs_location ON mh_jobs (snapshot_id, province_code, city_code);
CREATE INDEX IF NOT EXISTS mh_jobs_category ON mh_jobs (snapshot_id, category);
CREATE INDEX IF NOT EXISTS mh_jobs_portal ON mh_jobs (snapshot_id, portal_order);
CREATE INDEX IF NOT EXISTS mh_jobs_embedding_hash ON mh_jobs (embedding_hash);

CREATE TABLE IF NOT EXISTS mh_active_catalog (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  snapshot_id text NOT NULL REFERENCES mh_snapshots(id),
  activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_query_cache (
  hash text PRIMARY KEY,
  model text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions = 512),
  embedding vector(512) NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mh_query_cache_expiry ON mh_query_cache (expires_at);

CREATE TABLE IF NOT EXISTS mh_rate_limits (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  PRIMARY KEY (bucket, window_start)
);

CREATE TABLE IF NOT EXISTS mh_embedding_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES mh_snapshots(id),
  documents integer NOT NULL,
  tokens integer NOT NULL,
  estimated_cost_usd numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
