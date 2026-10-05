export type NodeStatus = 'ONLINE' | 'OFFLINE';

export interface FileRecord {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  chunkCount: number;
  createdAt: string;
}

export interface ChunkRecord {
  id: string;
  fileId: string;
  chunkIndex: number;
  size: number;
  checksum: string;
  nodeIds: string[];
}

export interface StorageNodeRecord {
  id: string;
  name: string;
  status: NodeStatus;
  capacity: number;
  usedSpace: number;
}

export interface ActivityEvent {
  id: string;
  message: string;
  createdAt: string;
}

export interface MetadataSnapshot {
  files: FileRecord[];
  chunks: ChunkRecord[];
  nodes: StorageNodeRecord[];
  events: ActivityEvent[];
}

export interface FileTopology extends FileRecord {
  chunks: Array<ChunkRecord & { replicas: Array<StorageNodeRecord | undefined> }>;
}
