import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class LocalStorageNode {
  public constructor(public readonly id: string, private readonly directory: string) {}

  public async initialize(): Promise<void> { await mkdir(this.directory, { recursive: true }); }
  public async writeChunk(chunkId: string, data: Buffer): Promise<void> { await writeFile(this.chunkPath(chunkId), data); }
  public async readChunk(chunkId: string): Promise<Buffer> { return readFile(this.chunkPath(chunkId)); }
  public async deleteChunk(chunkId: string): Promise<void> {
    try { await unlink(this.chunkPath(chunkId)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  public async hasChunk(chunkId: string): Promise<boolean> {
    try { await readFile(this.chunkPath(chunkId)); return true; } catch { return false; }
  }
  private chunkPath(chunkId: string): string { return path.join(this.directory, chunkId); }
}
