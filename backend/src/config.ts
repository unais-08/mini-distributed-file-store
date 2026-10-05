import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const config = {
  port: numberFromEnv('PORT', 8080),
  chunkSize: numberFromEnv('CHUNK_SIZE', 1024 * 1024),
  replicationFactor: numberFromEnv('REPLICATION_FACTOR', 2),
  storageRoot: path.resolve(process.env.STORAGE_ROOT ?? './storage'),
  metadataPath: path.resolve(process.env.METADATA_PATH ?? './data/metadata.json'),
  nodeCapacity: numberFromEnv('NODE_CAPACITY', 1024 * 1024 * 1024),
  databaseUrl: process.env.DATABASE_URL,
};
