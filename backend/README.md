# MiniDFS backend

A small distributed-file-system simulation. The Express coordinator splits uploads into fixed-size chunks, places each chunk on healthy local storage-node directories, records SHA-256 checksums, reconstructs downloads from healthy replicas, and repairs degraded replication.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

The server listens on `http://localhost:8080` by default. Chunks are stored under `storage/node-1`, `storage/node-2`, and `storage/node-3`.

### Environment variables

Copy `.env.example` to `.env` before starting the backend. The main settings are:

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | HTTP port for the coordinator | `8080` |
| `NODE_ENV` | Runtime environment | `development` |
| `CORS_ORIGINS` | Comma-separated frontend origins allowed to call the API | `http://localhost:3000` |
| `CHUNK_SIZE` | Chunk size in bytes | `1048576` |
| `REPLICATION_FACTOR` | Number of copies created for each chunk | `2` |
| `NODE_CAPACITY` | Capacity of each simulated storage node in bytes | `1073741824` |
| `STORAGE_ROOT` | Directory containing node storage directories | `./storage` |
| `METADATA_PATH` | JSON metadata path when PostgreSQL is not configured | `./data/metadata.json` |
| `DATABASE_URL` | Optional PostgreSQL connection string | `postgres://user:password@host:5432/minidfs` |

In development, requests are allowed from local development frontends. For a deployed backend, set `NODE_ENV=production` and provide the exact public frontend origin in `CORS_ORIGINS`:

```env
NODE_ENV=production
CORS_ORIGINS=https://app.example.com
```

Multiple frontend deployments can be separated by commas:

```env
CORS_ORIGINS=https://app.example.com,https://staging.example.com
```

Production startup fails if `CORS_ORIGINS` is empty. Origins must include the scheme and host, but should not include a trailing path (for example, use `https://app.example.com`, not `https://app.example.com/dashboard`).

When `DATABASE_URL` is set, PostgreSQL is the persistent metadata store. The backend creates the tables on startup and stores files, chunks, replica locations, nodes, and activity events there. When `DATABASE_URL` is absent, it falls back to `data/metadata.json` for a zero-dependency local demo.

Create the database once with PostgreSQL installed:

```bash
createdb minidfs
```

Then set `DATABASE_URL` in `.env` and start the backend. The same schema is also available in `schema.sql` for manual inspection or migrations.

## Production build

Install dependencies, compile the TypeScript source, and start the compiled server:

```bash
npm install
npm run build
npm start
```

Set production environment variables through the deployment platform rather than committing `.env` or database credentials to the repository.

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
