'use client';

import { useEffect, useState } from 'react';
import { dfsApi } from '../lib/api';
import type { ActivityEvent, FileRecord, FileTopology, StorageNode, SystemStatus } from '../lib/types';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (value: string): string => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function Home() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [selected, setSelected] = useState<FileTopology | null>(null);
  const [uploading, setUploading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async (fileId?: string, keepSelection = true) => {
    const [nextStatus, nextFiles, nextEvents] = await Promise.all([dfsApi.getStatus(), dfsApi.getFiles(), dfsApi.getEvents()]);
    setStatus(nextStatus);
    setFiles(nextFiles);
    setEvents(nextEvents);
    if (fileId) setSelected(await dfsApi.getTopology(fileId));
    else if (keepSelection && selected) setSelected(await dfsApi.getTopology(selected.id));
  };

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const [nextStatus, nextFiles, nextEvents] = await Promise.all([dfsApi.getStatus(), dfsApi.getFiles(), dfsApi.getEvents()]);
        setStatus(nextStatus);
        setFiles(nextFiles);
        setEvents(nextEvents);
      } catch { setMessage('Backend unavailable. Start it on port 8080.'); }
    };
    void loadInitialState();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setMessage('Chunking and placing replicas...');
    try {
      const created = await dfsApi.upload(file);
      await refresh(created.id);
      setMessage(`${created.originalName} uploaded across ${created.chunkCount} chunk${created.chunkCount === 1 ? '' : 's'}.`);
    } catch { setMessage('Upload failed. Check that enough storage nodes are online.'); }
    finally { setUploading(false); }
  };

  const toggleNode = async (node: StorageNode) => {
    try {
      await dfsApi.setNodeStatus(node.id, node.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
      await refresh();
      setMessage(`${node.name} is now ${node.status === 'ONLINE' ? 'offline' : 'online'}.`);
    } catch { setMessage('Could not change node status.'); }
  };

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const result = await dfsApi.repair();
      await refresh();
      setMessage(result.repairedReplicas ? `Repair restored ${result.repairedReplicas} replica${result.repairedReplicas === 1 ? '' : 's'}.` : 'Replication is already healthy.');
    } catch { setMessage('Repair could not find a healthy source replica.'); }
    finally { setRepairing(false); }
  };

  const handleDelete = async (file: FileTopology) => {
    if (!window.confirm(`Delete "${file.originalName}" and all of its replicas?`)) return;
    try {
      await dfsApi.deleteFile(file.id);
      setSelected(null);
      await refresh(undefined, false);
      setMessage(`${file.originalName} deleted.`);
    } catch { setMessage('Could not delete the file.'); }
  };

  const degradedChunks = selected?.chunks.filter((chunk) => chunk.replicas.filter(Boolean).filter((node) => node?.status === 'ONLINE').length < 2).length ?? 0;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">M</span><div><strong>MiniDFS</strong><span>distributed storage lab</span></div></div>
        <div className="connection"><span className="pulse" /> coordinator connected</div>
      </header>

      <section className="intro">
        <div><p className="eyebrow">SYSTEM CONTROL PLANE / LOCAL SIMULATION</p><h1>See where your data lives.</h1><p className="lede">Chunk placement, replica health, and failure recovery in one quiet little distributed system.</p></div>
        <button className="repair-button" onClick={() => void handleRepair()} disabled={repairing}><span>↻</span>{repairing ? 'Repairing...' : 'Repair replication'}</button>
      </section>

      {message && <div className="notice">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message">×</button></div>}

      <section className="metrics">
        <Metric label="Files" value={status?.totalFiles ?? 0} />
        <Metric label="Chunks" value={status?.totalChunks ?? 0} />
        <Metric label="Replicas" value={status?.totalReplicas ?? 0} />
        <Metric label="Healthy nodes" value={status ? `${status.healthyNodes}/${status.nodes.length}` : '—'} accent={status?.healthyNodes === status?.nodes.length} />
      </section>

      <div className="workspace-grid">
        <section className="panel nodes-panel"><PanelHeading title="Storage nodes" detail="local filesystem workers" />
          <div className="node-list">{status?.nodes.map((node) => <NodeCard key={node.id} node={node} onToggle={toggleNode} />)}</div>
        </section>

        <section className="panel upload-panel"><PanelHeading title="Add a file" detail="fixed-size chunking / 2 replicas" />
          <label className={`dropzone ${uploading ? 'is-uploading' : ''}`}><input type="file" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file); }} /><span className="upload-icon">↑</span><strong>{uploading ? 'Placing chunks...' : 'Choose a file to upload'}</strong><small>Data stays on this machine</small></label>
        </section>
      </div>

      <div className="content-grid">
        <section className="panel files-panel"><PanelHeading title="Files & topology" detail="select a file to inspect its replicas" />
          {files.length === 0 ? <div className="empty">No files yet. Upload one to map its chunks.</div> : <div className="file-list">{files.map((file) => <button key={file.id} className={`file-row ${selected?.id === file.id ? 'selected' : ''}`} onClick={() => void refresh(file.id)}><span className="file-icon">FILE</span><span className="file-name"><strong>{file.originalName}</strong><small>{file.chunkCount} chunks · {formatBytes(file.size)}</small></span><span className="file-arrow">→</span></button>)}</div>}
          {selected && <div className="topology"><div className="topology-heading"><div><p className="eyebrow">SELECTED FILE</p><h2>{selected.originalName}</h2></div><div className="file-actions"><a className="download" href={dfsApi.downloadUrl(selected.id)}>Download ↓</a><button className="delete-button" onClick={() => void handleDelete(selected)}>Delete</button></div></div><div className="health-line"><span className={degradedChunks ? 'warning-dot' : 'good-dot'} />{degradedChunks ? `${degradedChunks} chunk${degradedChunks === 1 ? '' : 's'} degraded` : 'All replicas healthy'}</div>{selected.chunks.map((chunk) => <div className="chunk-row" key={chunk.id}><div className="chunk-label"><strong>C{chunk.chunkIndex}</strong><small>{formatBytes(chunk.size)}</small></div><div className="replica-track">{chunk.replicas.map((node, index) => node ? <span className={`replica ${node.status === 'ONLINE' ? 'online' : 'offline'}`} key={node.id}><i />{node.name}<small>{index === 0 ? 'primary' : 'replica'}</small></span> : null)}</div></div>)}</div>}
        </section>

        <section className="panel activity-panel"><PanelHeading title="Activity" detail="coordinator event stream" /><div className="activity-list">{events.length === 0 ? <div className="empty">Waiting for system events.</div> : events.slice(0, 8).map((event) => <div className="event" key={event.id}><time>{formatTime(event.createdAt)}</time><span>{event.message}</span></div>)}</div></section>
      </div>
    </main>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) { return <div className="metric"><span>{label}</span><strong className={accent ? 'accent' : ''}>{value}</strong></div>; }
function PanelHeading({ title, detail }: { title: string; detail: string }) { return <div className="panel-heading"><h2>{title}</h2><span>{detail}</span></div>; }
function NodeCard({ node, onToggle }: { node: StorageNode; onToggle: (node: StorageNode) => void }) {
  const usage = node.capacity ? Math.round((node.usedSpace / node.capacity) * 100) : 0;
  return <article className={`node-card ${node.status.toLowerCase()}`}><div className="node-card-top"><div><span className="node-id">{node.id}</span><h3>{node.name}</h3></div><span className="status"><i />{node.status}</span></div><div className="usage"><div className="usage-label"><span>used capacity</span><span>{formatBytes(node.usedSpace)}</span></div><div className="usage-bar"><span style={{ width: `${usage}%` }} /></div></div><button className="node-action" onClick={() => onToggle(node)}>{node.status === 'ONLINE' ? 'Take offline' : 'Bring online'}</button></article>;
}
