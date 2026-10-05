import { createHash } from 'node:crypto';

export const checksum = (data: Buffer): string => createHash('sha256').update(data).digest('hex');
