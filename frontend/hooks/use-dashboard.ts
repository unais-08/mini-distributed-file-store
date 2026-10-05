import { useCallback, useEffect, useRef, useState } from 'react';
import { dfsApi } from '../lib/api';
import type { ActivityEvent, FileRecord, FileTopology, StorageNode, SystemStatus } from '../lib/types';

export function useDashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [selected, setSelected] = useState<FileTopology | null>(null);
  const [uploading, setUploading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [message, setMessage] = useState('');
  const selectedRef = useRef<FileTopology | null>(null);

  const refresh = useCallback(async (fileId?: string, keepSelection = true) => {
    const [nextStatus, nextFiles, nextEvents] = await Promise.all([
      dfsApi.getStatus(),
      dfsApi.getFiles(),
      dfsApi.getEvents(),
    ]);
    setStatus(nextStatus);
    setFiles(nextFiles);
    setEvents(nextEvents);

    if (fileId) {
      const topology = await dfsApi.getTopology(fileId);
      selectedRef.current = topology;
      setSelected(topology);
    } else if (keepSelection && selectedRef.current) {
      setSelected(await dfsApi.getTopology(selectedRef.current.id));
    }
  }, []);

  const selectFile = useCallback(async (fileId: string) => {
    const topology = await dfsApi.getTopology(fileId);
    selectedRef.current = topology;
    setSelected(topology);
  }, []);

  const clearSelection = () => {
    selectedRef.current = null;
    setSelected(null);
  };

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        await refresh();
      } catch {
        setMessage('Backend unavailable. Start it on port 8080.');
      }
    };
    void loadInitialState();
  }, [refresh]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setMessage('Chunking and placing replicas...');
    try {
      const created = await dfsApi.upload(file);
      await refresh(created.id);
      setMessage(`${created.originalName} uploaded across ${created.chunkCount} chunk${created.chunkCount === 1 ? '' : 's'}.`);
    } catch {
      setMessage('Upload failed. Check that enough storage nodes are online.');
    } finally {
      setUploading(false);
    }
  };

  const toggleNode = async (node: StorageNode) => {
    try {
      await dfsApi.setNodeStatus(node.id, node.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
      await refresh();
      setMessage(`${node.name} is now ${node.status === 'ONLINE' ? 'offline' : 'online'}.`);
    } catch {
      setMessage('Could not change node status.');
    }
  };

  const repair = async () => {
    setRepairing(true);
    try {
      const result = await dfsApi.repair();
      await refresh();
      setMessage(result.repairedReplicas ? `Repair restored ${result.repairedReplicas} replica${result.repairedReplicas === 1 ? '' : 's'}.` : 'Replication is already healthy.');
    } catch {
      setMessage('Repair could not find a healthy source replica.');
    } finally {
      setRepairing(false);
    }
  };

  const deleteFile = async (file: FileTopology) => {
    if (!window.confirm(`Delete "${file.originalName}" and all of its replicas?`)) return;
    try {
      await dfsApi.deleteFile(file.id);
      clearSelection();
      await refresh(undefined, false);
      setMessage(`${file.originalName} deleted.`);
    } catch {
      setMessage('Could not delete the file.');
    }
  };

  return {
    status,
    files,
    events,
    selected,
    uploading,
    repairing,
    message,
    setMessage,
    refresh,
    selectFile,
    uploadFile,
    toggleNode,
    repair,
    deleteFile,
  };
}
