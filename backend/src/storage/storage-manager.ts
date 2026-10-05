import path from 'node:path';
import { LocalStorageNode } from './local-storage-node.js';
import type { StorageNodeRecord } from '../types/index.js';

export class StorageManager {
  private readonly adapters = new Map<string, LocalStorageNode>();

  public constructor(private readonly root: string) {}

  public async initialize(nodes: StorageNodeRecord[]): Promise<void> {
    for (const node of nodes) {
      const adapter = new LocalStorageNode(node.id, path.join(this.root, node.id));
      await adapter.initialize();
      this.adapters.set(node.id, adapter);
    }
  }

  public adapter(nodeId: string): LocalStorageNode {
    const adapter = this.adapters.get(nodeId);
    if (!adapter) throw new Error(`Storage node ${nodeId} is not configured`);
    return adapter;
  }
}
