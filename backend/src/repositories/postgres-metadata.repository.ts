import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { ActivityEvent, ChunkRecord, FileRecord, MetadataSnapshot, StorageNodeRecord } from '../types/index.js';
import type { MetadataStore } from './metadata-store.js';

const emptySnapshot = (): MetadataSnapshot => ({ files: [], chunks: [], nodes: [], events: [] });

const schema = `
CREATE TABLE IF NOT EXISTS storage_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ONLINE', 'OFFLINE')),
  capacity BIGINT NOT NULL,
  used_space BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  original_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  size INTEGER NOT NULL,
  checksum CHAR(64) NOT NULL,
  UNIQUE (file_id, chunk_index)
);
CREATE TABLE IF NOT EXISTS chunk_replicas (
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES storage_nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (chunk_id, node_id)
);
CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export class PostgresMetadataRepository implements MetadataStore {
  private snapshot: MetadataSnapshot = emptySnapshot();
  private readonly pool: Pool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  public async initialize(defaultNodes: StorageNodeRecord[]): Promise<void> {
    await this.pool.query(schema);
    for (const node of defaultNodes) {
      await this.pool.query(
        `INSERT INTO storage_nodes (id, name, status, capacity, used_space)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [node.id, node.name, node.status, node.capacity, node.usedSpace],
      );
    }
    await this.reload();
  }

  public listFiles(): FileRecord[] { return [...this.snapshot.files]; }
  public getFile(id: string): FileRecord | undefined { return this.snapshot.files.find((file) => file.id === id); }
  public listChunks(fileId?: string): ChunkRecord[] {
    return this.snapshot.chunks.filter((chunk) => fileId === undefined || chunk.fileId === fileId);
  }
  public listNodes(): StorageNodeRecord[] { return this.snapshot.nodes.map((node) => ({ ...node })); }
  public getNode(id: string): StorageNodeRecord | undefined { return this.snapshot.nodes.find((node) => node.id === id); }
  public listEvents(): ActivityEvent[] { return [...this.snapshot.events].reverse(); }

  public async addFile(file: FileRecord, chunks: ChunkRecord[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO files (id, original_name, size, mime_type, chunk_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [file.id, file.originalName, file.size, file.mimeType, file.chunkCount, file.createdAt],
      );
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO chunks (id, file_id, chunk_index, size, checksum)
           VALUES ($1, $2, $3, $4, $5)`,
          [chunk.id, chunk.fileId, chunk.chunkIndex, chunk.size, chunk.checksum],
        );
        for (const nodeId of chunk.nodeIds) {
          await client.query('INSERT INTO chunk_replicas (chunk_id, node_id) VALUES ($1, $2)', [chunk.id, nodeId]);
        }
      }
      await client.query('COMMIT');
      this.snapshot.files.push(file);
      this.snapshot.chunks.push(...chunks);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  public async deleteFile(fileId: string): Promise<void> {
    await this.pool.query('DELETE FROM files WHERE id = $1', [fileId]);
    this.snapshot.files = this.snapshot.files.filter((file) => file.id !== fileId);
    this.snapshot.chunks = this.snapshot.chunks.filter((chunk) => chunk.fileId !== fileId);
  }

  public async updateChunk(chunk: ChunkRecord): Promise<void> {
    await this.pool.query('UPDATE chunks SET size = $2, checksum = $3 WHERE id = $1', [chunk.id, chunk.size, chunk.checksum]);
    await this.pool.query('DELETE FROM chunk_replicas WHERE chunk_id = $1', [chunk.id]);
    for (const nodeId of chunk.nodeIds) {
      await this.pool.query('INSERT INTO chunk_replicas (chunk_id, node_id) VALUES ($1, $2)', [chunk.id, nodeId]);
    }
    const index = this.snapshot.chunks.findIndex((item) => item.id === chunk.id);
    if (index >= 0) this.snapshot.chunks[index] = chunk;
  }

  public async updateNode(node: StorageNodeRecord): Promise<void> {
    await this.pool.query(
      'UPDATE storage_nodes SET name = $2, status = $3, capacity = $4, used_space = $5 WHERE id = $1',
      [node.id, node.name, node.status, node.capacity, node.usedSpace],
    );
    const index = this.snapshot.nodes.findIndex((item) => item.id === node.id);
    if (index >= 0) this.snapshot.nodes[index] = { ...node };
  }

  public async addEvent(message: string): Promise<void> {
    const event = { id: randomUUID(), message, createdAt: new Date().toISOString() };
    await this.pool.query('INSERT INTO activity_events (id, message, created_at) VALUES ($1, $2, $3)', [event.id, event.message, event.createdAt]);
    await this.pool.query(`DELETE FROM activity_events WHERE id NOT IN (SELECT id FROM activity_events ORDER BY created_at DESC LIMIT 200)`);
    this.snapshot.events.push(event);
    this.snapshot.events = this.snapshot.events.slice(-200);
  }

  private async reload(): Promise<void> {
    const [files, chunks, replicas, nodes, events] = await Promise.all([
      this.pool.query('SELECT id, original_name, size, mime_type, chunk_count, created_at FROM files ORDER BY created_at'),
      this.pool.query('SELECT id, file_id, chunk_index, size, checksum FROM chunks ORDER BY chunk_index'),
      this.pool.query('SELECT chunk_id, node_id FROM chunk_replicas'),
      this.pool.query('SELECT id, name, status, capacity, used_space FROM storage_nodes ORDER BY id'),
      this.pool.query('SELECT id, message, created_at FROM activity_events ORDER BY created_at'),
    ]);
    const nodeIds = new Map<string, string[]>();
    for (const row of replicas.rows as Array<{ chunk_id: string; node_id: string }>) {
      nodeIds.set(row.chunk_id, [...(nodeIds.get(row.chunk_id) ?? []), row.node_id]);
    }
    this.snapshot = {
      files: (files.rows as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), originalName: String(row.original_name), size: Number(row.size), mimeType: String(row.mime_type), chunkCount: Number(row.chunk_count), createdAt: new Date(String(row.created_at)).toISOString() })),
      chunks: (chunks.rows as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), fileId: String(row.file_id), chunkIndex: Number(row.chunk_index), size: Number(row.size), checksum: String(row.checksum), nodeIds: nodeIds.get(String(row.id)) ?? [] })),
      nodes: (nodes.rows as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), name: String(row.name), status: row.status as StorageNodeRecord['status'], capacity: Number(row.capacity), usedSpace: Number(row.used_space) })),
      events: (events.rows as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), message: String(row.message), createdAt: new Date(String(row.created_at)).toISOString() })),
    };
  }
}
