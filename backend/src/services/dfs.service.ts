import { randomUUID } from 'node:crypto';
import { splitIntoChunks } from '../chunking/chunker.js';
import { config } from '../config.js';
import type { MetadataStore } from '../repositories/metadata-store.js';
import { StorageManager } from '../storage/storage-manager.js';
import type { ChunkRecord, FileTopology, FileRecord, StorageNodeRecord } from '../types/index.js';
import { checksum } from '../utils/checksum.js';

export class DfsError extends Error {
    public constructor(public readonly statusCode: number, message: string) { super(message); }
}

export class DfsService {
    private placementCursor = 0;

    public constructor(
        private readonly metadata: MetadataStore,
        private readonly storage: StorageManager,
    ) { }

    public async upload(file: { originalname: string; mimetype: string; buffer: Buffer }): Promise<FileRecord> {
        const nodes = this.onlineNodes();
        if (nodes.length < config.replicationFactor) {
            throw new DfsError(503, 'Replication factor cannot be satisfied by healthy nodes');
        }
        const fileRecord: FileRecord = {
            id: randomUUID(), originalName: file.originalname, size: file.buffer.length,
            mimeType: file.mimetype || 'application/octet-stream', chunkCount: 0, createdAt: new Date().toISOString(),
        };
        const chunks: ChunkRecord[] = [];
        for (const chunk of splitIntoChunks(file.buffer, config.chunkSize)) {
            const replicaNodes = this.selectNodes(nodes);
            const chunkRecord: ChunkRecord = {
                id: `chunk-${randomUUID()}`, fileId: fileRecord.id, chunkIndex: chunk.index,
                size: chunk.data.length, checksum: checksum(chunk.data), nodeIds: replicaNodes.map((node) => node.id),
            };
            for (const node of replicaNodes) {
                await this.storage.adapter(node.id).writeChunk(chunkRecord.id, chunk.data);
                node.usedSpace += chunk.data.length;
                await this.metadata.updateNode(node);
            }
            chunks.push(chunkRecord);
            await this.metadata.addEvent(`Created ${chunkRecord.id} and replicated it to ${chunkRecord.nodeIds.join(', ')}`);
        }
        fileRecord.chunkCount = chunks.length;
        await this.metadata.addFile(fileRecord, chunks);
        await this.metadata.addEvent(`File uploaded: ${fileRecord.originalName}`);
        return fileRecord;
    }

    public async deleteFile(fileId: string): Promise<void> {
        const file = this.requireFile(fileId);
        const chunks = this.metadata.listChunks(fileId);
        const usageByNode = new Map<string, number>();

        for (const chunk of chunks) {
            for (const nodeId of chunk.nodeIds) {
                await this.storage.adapter(nodeId).deleteChunk(chunk.id);
                usageByNode.set(nodeId, (usageByNode.get(nodeId) ?? 0) + chunk.size);
            }
        }

        for (const [nodeId, releasedSpace] of usageByNode) {
            const node = this.metadata.getNode(nodeId);
            if (!node) throw new DfsError(500, `Storage node ${nodeId} was not found`);
            node.usedSpace = Math.max(0, node.usedSpace - releasedSpace);
            await this.metadata.updateNode(node);
        }

        await this.metadata.deleteFile(fileId);
        await this.metadata.addEvent(`File deleted: ${file.originalName}`);
    }

    public async download(fileId: string): Promise<{ file: FileRecord; data: Buffer }> {
        const file = this.requireFile(fileId);
        const chunks = this.metadata.listChunks(fileId).sort((a, b) => a.chunkIndex - b.chunkIndex);
        const data: Buffer[] = [];
        for (const chunk of chunks) {
            const source = chunk.nodeIds.map((id) => this.metadata.getNode(id)).find((node) => node?.status === 'ONLINE');
            if (!source) throw new DfsError(503, `All replicas for ${chunk.id} are unavailable`);
            const chunkData = await this.storage.adapter(source.id).readChunk(chunk.id);
            if (checksum(chunkData) !== chunk.checksum) throw new DfsError(500, `Checksum mismatch for ${chunk.id}`);
            data.push(chunkData);
            await this.metadata.addEvent(`Read ${chunk.id} from ${source.id}`);
        }
        return { file, data: Buffer.concat(data) };
    }

    public async setNodeStatus(nodeId: string, status: StorageNodeRecord['status']): Promise<StorageNodeRecord> {
        const node = this.metadata.getNode(nodeId);
        if (!node) throw new DfsError(404, `Storage node ${nodeId} was not found`);
        node.status = status;
        await this.metadata.updateNode(node);
        await this.metadata.addEvent(`${node.name} marked ${status}`);
        return node;
    }

    public async repair(): Promise<{ repairedChunks: number; repairedReplicas: number }> {
        const nodes = this.onlineNodes();
        let repairedChunks = 0;
        let repairedReplicas = 0;
        for (const chunk of this.metadata.listChunks()) {
            const healthyIds = chunk.nodeIds.filter((id) => this.metadata.getNode(id)?.status === 'ONLINE');
            let chunkRepaired = false;
            while (healthyIds.length < config.replicationFactor) {
                const sourceId = healthyIds[0];
                if (!sourceId) throw new DfsError(503, `Cannot repair ${chunk.id}: no healthy source replica`);
                const target = nodes.find((node) => !chunk.nodeIds.includes(node.id));
                if (!target) break;
                const data = await this.storage.adapter(sourceId).readChunk(chunk.id);
                if (checksum(data) !== chunk.checksum) throw new DfsError(500, `Checksum mismatch for ${chunk.id}`);
                await this.storage.adapter(target.id).writeChunk(chunk.id, data);
                target.usedSpace += data.length;
                await this.metadata.updateNode(target);
                chunk.nodeIds = [...healthyIds, target.id];
                healthyIds.push(target.id);
                repairedReplicas += 1;
                chunkRepaired = true;
                await this.metadata.addEvent(`${chunk.id} copied to ${target.id}`);
            }
            if (chunkRepaired) {
                await this.metadata.updateChunk(chunk);
                repairedChunks += 1;
            }
        }
        if (repairedReplicas > 0) await this.metadata.addEvent(`Replication repair restored ${repairedReplicas} replicas`);
        return { repairedChunks, repairedReplicas };
    }

    public listFiles(): FileRecord[] { return this.metadata.listFiles(); }
    public listNodes(): StorageNodeRecord[] { return this.metadata.listNodes(); }
    public listEvents() { return this.metadata.listEvents(); }
    public getFileTopology(fileId: string): FileTopology {
        const file = this.requireFile(fileId);
        const chunks = this.metadata.listChunks(fileId).sort((a, b) => a.chunkIndex - b.chunkIndex);
        return { ...file, chunks: chunks.map((chunk) => ({ ...chunk, replicas: chunk.nodeIds.map((id) => this.metadata.getNode(id)) })) };
    }
    public systemStatus() {
        const nodes = this.listNodes();
        const chunks = this.metadata.listChunks();
        return {
            nodes, totalFiles: this.listFiles().length, totalChunks: chunks.length,
            totalReplicas: chunks.reduce((total, chunk) => total + chunk.nodeIds.length, 0),
            healthyNodes: nodes.filter((node) => node.status === 'ONLINE').length,
        };
    }

    private requireFile(fileId: string): FileRecord {
        const file = this.metadata.getFile(fileId);
        if (!file) throw new DfsError(404, 'File was not found');
        return file;
    }

    private onlineNodes(): StorageNodeRecord[] {
        return this.metadata.listNodes().filter((node) => node.status === 'ONLINE');
    }

    private selectNodes(nodes: StorageNodeRecord[]): StorageNodeRecord[] {
        const selected: StorageNodeRecord[] = [];
        for (let offset = 0; selected.length < config.replicationFactor; offset += 1) {
            const node = nodes[(this.placementCursor + offset) % nodes.length];
            if (node && !selected.some((item) => item.id === node.id)) selected.push(node);
        }
        this.placementCursor = (this.placementCursor + 1) % nodes.length;
        return selected;
    }
}
