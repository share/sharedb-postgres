CREATE TABLE IF NOT EXISTS ops (
  collection character varying(255) not null,
  doc_id character varying(255) not null,
  version integer not null,
  operation jsonb not null, -- {v:0, create:{...}} or {v:n, op:[...]}
  PRIMARY KEY (collection, doc_id, version)
);

CREATE TABLE IF NOT EXISTS snapshots (
  collection character varying(255) not null,
  doc_id character varying(255) not null,
  doc_type character varying(255) not null,
  version integer not null,
  data jsonb not null,
  PRIMARY KEY (collection, doc_id)
);

CREATE INDEX IF NOT EXISTS snapshots_version ON snapshots (collection, doc_id);

ALTER TABLE ops
  ALTER COLUMN operation
  SET DATA TYPE jsonb
  USING operation::jsonb;

ALTER TABLE snapshots
  ALTER COLUMN data
  SET DATA TYPE jsonb
  USING data::jsonb;


-- v5.0.0 --

ALTER TABLE snapshots
  ALTER column doc_type
  DROP NOT NULL;

ALTER TABLE snapshots
  ALTER column data
  DROP NOT NULL;

ALTER TABLE snapshots
  ADD metadata jsonb;
