import axios from 'axios';
import type { ActivityEvent, FileRecord, FileTopology, RepairResult, StorageNode, SystemStatus } from './types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api',
  headers: { Accept: 'application/json' },
});

export const dfsApi = {
  async getStatus(): Promise<SystemStatus> {
    return (await api.get<SystemStatus>('/system/status')).data;
  },
  async getFiles(): Promise<FileRecord[]> {
    return (await api.get<FileRecord[]>('/files')).data;
  },
  async getEvents(): Promise<ActivityEvent[]> {
    return (await api.get<ActivityEvent[]>('/system/events')).data;
  },
  async getTopology(fileId: string): Promise<FileTopology> {
    return (await api.get<FileTopology>(`/files/${fileId}/topology`)).data;
  },
  async upload(file: File): Promise<FileRecord> {
    const formData = new FormData();
    formData.append('file', file);
    return (await api.post<FileRecord>('/files/upload', formData)).data;
  },
  async deleteFile(fileId: string): Promise<void> {
    await api.delete(`/files/${fileId}`);
  },
  async setNodeStatus(nodeId: string, status: StorageNode['status']): Promise<StorageNode> {
    const endpoint = status === 'ONLINE' ? 'online' : 'offline';
    return (await api.post<StorageNode>(`/nodes/${nodeId}/${endpoint}`)).data;
  },
  async repair(): Promise<RepairResult> {
    return (await api.post<RepairResult>('/system/repair')).data;
  },
  downloadUrl(fileId: string): string {
    return `${api.defaults.baseURL}/files/${fileId}/download`;
  },
};
