import type { StorageNode } from '../lib/types';
import { formatBytes } from '../lib/utils';
import { PanelHeading, Panel } from './dashboard-ui';

export function StorageNodes({ nodes, onToggle }: { nodes: StorageNode[]; onToggle: (node: StorageNode) => void }) {
  return <Panel className="nodes-panel">
    <PanelHeading title="Storage nodes" detail="local filesystem workers" />
    <div className="node-list">{nodes.map((node) => <NodeCard key={node.id} node={node} onToggle={onToggle} />)}</div>
  </Panel>;
}

function NodeCard({ node, onToggle }: { node: StorageNode; onToggle: (node: StorageNode) => void }) {
  const usage = node.capacity ? Math.round((node.usedSpace / node.capacity) * 100) : 0;
  return <article className={`node-card ${node.status.toLowerCase()}`}>
    <div className="node-card-top"><div><span className="node-id">{node.id}</span><h3>{node.name}</h3></div><span className="status"><i />{node.status}</span></div>
    <div className="usage"><div className="usage-label"><span>used capacity</span><span>{formatBytes(node.usedSpace)}</span></div><div className="usage-bar"><span style={{ width: `${usage}%` }} /></div></div>
    <button className="node-action" onClick={() => onToggle(node)}>{node.status === 'ONLINE' ? 'Take offline' : 'Bring online'}</button>
  </article>;
}
