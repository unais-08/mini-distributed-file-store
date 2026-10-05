# MiniDFS backend

A small distributed-file-system simulation. The Express coordinator splits uploads into fixed-size chunks, places each chunk on healthy local storage-node directories, records SHA-256 checksums, reconstructs downloads from healthy replicas, and repairs degraded replication.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

The server listens on `http://localhost:8080` by default. Chunks are stored under `storage/node-1`, `storage/node-2`, and `storage/node-3`.

When `DATABASE_URL` is set, PostgreSQL is the persistent metadata store. The backend creates the tables on startup and stores files, chunks, replica locations, nodes, and activity events there. When `DATABASE_URL` is absent, it falls back to `data/metadata.json` for a zero-dependency local demo.

Create the database once with PostgreSQL installed:

```bash
createdb minidfs
```

Then set `DATABASE_URL` in `.env` and start the backend. The same schema is also available in `schema.sql` for manual inspection or migrations.

To clear all PostgreSQL metadata and restore the default online storage nodes:

```bash
npm run db:reset
```

The reset command requires `DATABASE_URL` and does not remove chunk files from the local `STORAGE_ROOT`. Stop the backend before running it, then remove stale storage files separately if a completely empty filesystem is required.

## API

- `POST /api/files/upload` with multipart field `file`
- `GET /api/files`
- `GET /api/files/:id`
- `GET /api/files/:id/topology`
- `GET /api/files/:id/download`
- `GET /api/system/status`
- `GET /api/system/events`
- `POST /api/system/repair`
- `GET /api/nodes`
- `POST /api/nodes/:id/offline`
- `POST /api/nodes/:id/online`

The upload response contains the file id. Use it to download or inspect topology. The demo requires at least `REPLICATION_FACTOR` healthy nodes for upload and uses the remaining healthy node during repair.
