export type NodeStatus = 'ONLINE' | 'OFFLINE';

export interface StorageNode {
  id: string;
  name: string;
  status: NodeStatus;
  capacity: number;
  usedSpace: number;
}

export interface FileRecord {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  chunkCount: number;
  createdAt: string;
}

export type ChunkReplica = StorageNode;

export interface ChunkTopology {
  id: string;
  fileId: string;
  chunkIndex: number;
  size: number;
  checksum: string;
  nodeIds: string[];
  replicas: Array<ChunkReplica | undefined>;
}

export interface FileTopology extends FileRecord {
  chunks: ChunkTopology[];
}

export interface SystemStatus {
  nodes: StorageNode[];
  totalFiles: number;
  totalChunks: number;
  totalReplicas: number;
  healthyNodes: number;
}

export interface ActivityEvent {
  id: string;
  message: string;
  createdAt: string;
}

export interface RepairResult {
  repairedChunks: number;
  repairedReplicas: number;
}
