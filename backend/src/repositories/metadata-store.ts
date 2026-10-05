import type { ActivityEvent, ChunkRecord, FileRecord, StorageNodeRecord } from '../types/index.js';

export interface MetadataStore {
  initialize(defaultNodes: StorageNodeRecord[]): Promise<void>;
  listFiles(): FileRecord[];
  getFile(id: string): FileRecord | undefined;
  listChunks(fileId?: string): ChunkRecord[];
  listNodes(): StorageNodeRecord[];
  getNode(id: string): StorageNodeRecord | undefined;
  listEvents(): ActivityEvent[];
  addFile(file: FileRecord, chunks: ChunkRecord[]): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
  updateChunk(chunk: ChunkRecord): Promise<void>;
  updateNode(node: StorageNodeRecord): Promise<void>;
  addEvent(message: string): Promise<void>;
}
