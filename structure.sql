CREATE TABLE ops (
  collection character varying(255) not null,
  doc_id character varying(255) not null,
  version integer not null,
  operation jsonb not null, -- {v:0, create:{...}} or {v:n, op:[...]}
  PRIMARY KEY (collection, doc_id, version)
);

CREATE TABLE snapshots (
  collection character varying(255) not null,
  doc_id character varying(255) not null,
  doc_type character varying(255), -- Will be set to null if deleted
  version integer not null,
  data jsonb, -- Will be set to null if deleted
  PRIMARY KEY (collection, doc_id)
);
