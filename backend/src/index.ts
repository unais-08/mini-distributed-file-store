import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from './config.js';
import { MetadataRepository } from './repositories/metadata.repository.js';
import { PostgresMetadataRepository } from './repositories/postgres-metadata.repository.js';
import { DfsError, DfsService } from './services/dfs.service.js';
import { StorageManager } from './storage/storage-manager.js';
import type { StorageNodeRecord } from './types/index.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

const defaultNodes: StorageNodeRecord[] = [1, 2, 3].map((number) => ({
    id: `node-${number}`, name: `Node ${number}`, status: 'ONLINE', capacity: config.nodeCapacity, usedSpace: 0,
}));
const metadata = config.databaseUrl
    ? new PostgresMetadataRepository(config.databaseUrl)
    : new MetadataRepository(config.metadataPath);
const storage = new StorageManager(config.storageRoot);
const dfs = new DfsService(metadata, storage);

// Basic Route
app.get('/', (_req: Request, res: Response) => {
    res.json({ name: 'MiniDFS', status: 'running' });
});

app.get('/api/files', (_req, res) => res.json(dfs.listFiles()));
app.get('/api/files/:id', (req, res) => res.json(dfs.getFileTopology(req.params.id)));
app.get('/api/files/:id/topology', (req, res) => res.json(dfs.getFileTopology(req.params.id)));
app.post('/api/files/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) throw new DfsError(400, 'A multipart field named file is required');
        res.status(201).json(await dfs.upload({ originalname: req.file.originalname, mimetype: req.file.mimetype, buffer: req.file.buffer }));
    } catch (error) { next(error); }
});
app.get('/api/files/:id/download', async (req, res, next) => {
    try {
        const result = await dfs.download(req.params.id);
        res.setHeader('Content-Type', result.file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.file.originalName)}"`);
        res.send(result.data);
    } catch (error) { next(error); }
});
app.delete('/api/files/:id', async (req, res, next) => {
    try {
        await dfs.deleteFile(req.params.id);
        res.status(204).send();
    } catch (error) { next(error); }
});
app.get('/api/system/status', (_req, res) => res.json(dfs.systemStatus()));
app.get('/api/system/events', (_req, res) => res.json(dfs.listEvents()));
app.post('/api/system/repair', async (_req, res, next) => {
    try { res.json(await dfs.repair()); } catch (error) { next(error); }
});
app.get('/api/nodes', (_req, res) => res.json(dfs.listNodes()));
app.post('/api/nodes/:id/offline', async (req, res, next) => {
    try { res.json(await dfs.setNodeStatus(req.params.id, 'OFFLINE')); } catch (error) { next(error); }
});
app.post('/api/nodes/:id/online', async (req, res, next) => {
    try { res.json(await dfs.setNodeStatus(req.params.id, 'ONLINE')); } catch (error) { next(error); }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof DfsError) { res.status(error.statusCode).json({ error: error.message }); return; }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
});

const start = async (): Promise<void> => {
    await metadata.initialize(defaultNodes);
    await storage.initialize(metadata.listNodes());
    app.listen(config.port, () => console.log(`MiniDFS listening on http://localhost:${config.port}`));
};

void start();
