CREATE TABLE storage_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ONLINE', 'OFFLINE')),
  capacity BIGINT NOT NULL,
  used_space BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE files (
  id UUID PRIMARY KEY,
  original_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  size INTEGER NOT NULL,
  checksum CHAR(64) NOT NULL,
  UNIQUE (file_id, chunk_index)
);

CREATE TABLE chunk_replicas (
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES storage_nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (chunk_id, node_id)
);

CREATE TABLE activity_events (
  id UUID PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
