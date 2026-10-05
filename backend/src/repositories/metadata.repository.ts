import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ActivityEvent, ChunkRecord, FileRecord, MetadataSnapshot, StorageNodeRecord } from '../types/index.js';
import type { MetadataStore } from './metadata-store.js';

const emptySnapshot = (): MetadataSnapshot => ({ files: [], chunks: [], nodes: [], events: [] });

export class MetadataRepository implements MetadataStore {
  private snapshot: MetadataSnapshot = emptySnapshot();

  public constructor(private readonly filePath: string) {}

  public async initialize(defaultNodes: StorageNodeRecord[]): Promise<void> {
    try {
      this.snapshot = JSON.parse(await readFile(this.filePath, 'utf8')) as MetadataSnapshot;
    } catch {
      this.snapshot = { ...emptySnapshot(), nodes: defaultNodes };
      await this.persist();
    }
    if (this.snapshot.nodes.length === 0) {
      this.snapshot.nodes = defaultNodes;
      await this.persist();
    }
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
    this.snapshot.files.push(file);
    this.snapshot.chunks.push(...chunks);
    await this.persist();
  }

  public async deleteFile(fileId: string): Promise<void> {
    this.snapshot.files = this.snapshot.files.filter((file) => file.id !== fileId);
    this.snapshot.chunks = this.snapshot.chunks.filter((chunk) => chunk.fileId !== fileId);
    await this.persist();
  }

  public async updateChunk(chunk: ChunkRecord): Promise<void> {
    const index = this.snapshot.chunks.findIndex((item) => item.id === chunk.id);
    if (index >= 0) this.snapshot.chunks[index] = chunk;
    await this.persist();
  }

  public async updateNode(node: StorageNodeRecord): Promise<void> {
    const index = this.snapshot.nodes.findIndex((item) => item.id === node.id);
    if (index >= 0) this.snapshot.nodes[index] = node;
    await this.persist();
  }

  public async addEvent(message: string): Promise<void> {
    this.snapshot.events.push({ id: randomUUID(), message, createdAt: new Date().toISOString() });
    this.snapshot.events = this.snapshot.events.slice(-200);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.snapshot, null, 2), 'utf8');
    await rename(temporaryPath, this.filePath);
  }
}
