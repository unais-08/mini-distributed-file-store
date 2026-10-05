import { dfsApi } from '../lib/api';
import type { FileRecord, FileTopology } from '../lib/types';
import { formatBytes } from '../lib/utils';
import { Panel, PanelHeading } from './dashboard-ui';

export function FileTopologyPanel({
  files,
  selected,
  onSelect,
  onDelete,
}: {
  files: FileRecord[];
  selected: FileTopology | null;
  onSelect: (fileId: string) => void;
  onDelete: (file: FileTopology) => void;
}) {
  const degradedChunks = selected?.chunks.filter((chunk) => chunk.replicas.filter(Boolean).filter((node) => node?.status === 'ONLINE').length < 2).length ?? 0;

  return <Panel className="files-panel">
    <PanelHeading title="Files & topology" detail="select a file to inspect its replicas" />
    {files.length === 0 ? <div className="empty">No files yet. Upload one to map its chunks.</div> : <div className="file-list">{files.map((file) => <button key={file.id} className={`file-row ${selected?.id === file.id ? 'selected' : ''}`} onClick={() => onSelect(file.id)}><span className="file-icon">FILE</span><span className="file-name"><strong>{file.originalName}</strong><small>{file.chunkCount} chunks · {formatBytes(file.size)}</small></span><span className="file-arrow">→</span></button>)}</div>}
    {selected && <div className="topology">
      <div className="topology-heading"><div><p className="eyebrow">SELECTED FILE</p><h2>{selected.originalName}</h2></div><div className="file-actions"><a className="download" href={dfsApi.downloadUrl(selected.id)}>Download ↓</a><button className="delete-button" onClick={() => onDelete(selected)}>Delete</button></div></div>
      <div className="health-line"><span className={degradedChunks ? 'warning-dot' : 'good-dot'} />{degradedChunks ? `${degradedChunks} chunk${degradedChunks === 1 ? '' : 's'} degraded` : 'All replicas healthy'}</div>
      {selected.chunks.map((chunk) => <div className="chunk-row" key={chunk.id}><div className="chunk-label"><strong>C{chunk.chunkIndex}</strong><small>{formatBytes(chunk.size)}</small></div><div className="replica-track">{chunk.replicas.map((node, index) => node ? <span className={`replica ${node.status === 'ONLINE' ? 'online' : 'offline'}`} key={node.id}><i />{node.name}<small>{index === 0 ? 'primary' : 'replica'}</small></span> : null)}</div></div>)}
    </div>}
  </Panel>;
}
