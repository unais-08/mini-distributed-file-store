export interface ChunkData {
  index: number;
  data: Buffer;
}

export const splitIntoChunks = (data: Buffer, chunkSize: number): ChunkData[] => {
  const chunks: ChunkData[] = [];
  for (let offset = 0, index = 0; offset < data.length; offset += chunkSize, index += 1) {
    chunks.push({ index, data: data.subarray(offset, Math.min(offset + chunkSize, data.length)) });
  }
  return chunks.length > 0 ? chunks : [{ index: 0, data: Buffer.alloc(0) }];
};
