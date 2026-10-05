'use client';

import { useState } from 'react';
import { ActivityPanel } from '../components/activity-panel';
import { DashboardHeader, Intro, Metric, Notice, type DashboardView } from '../components/dashboard-ui';
import { FileTopologyPanel } from '../components/file-topology';
import { StorageNodes } from '../components/storage-nodes';
import { UploadPanel } from '../components/upload-panel';
import { useDashboard } from '../hooks/use-dashboard';

export default function Home() {
  const dashboard = useDashboard();
  const [view, setView] = useState<DashboardView>('overview');
  const { status, files, events, selected, uploading, repairing, message, setMessage } = dashboard;

  return <main className="shell">
    <DashboardHeader activeView={view} onViewChange={setView} />
    <Intro repairing={repairing} onRepair={() => void dashboard.repair()} />
    {message && <Notice message={message} onDismiss={() => setMessage('')} />}

    {view === 'overview' && <>
      <section className="metrics">
        <Metric label="Files" value={status?.totalFiles ?? 0} />
        <Metric label="Chunks" value={status?.totalChunks ?? 0} />
        <Metric label="Replicas" value={status?.totalReplicas ?? 0} />
        <Metric label="Healthy nodes" value={status ? `${status.healthyNodes}/${status.nodes.length}` : '—'} accent={status?.healthyNodes === status?.nodes.length} />
      </section>
      <div className="overview-grid">
        <FileTopologyPanel files={files} selected={selected} onSelect={(fileId) => void dashboard.selectFile(fileId)} onDelete={(file) => void dashboard.deleteFile(file)} />
        <div className="overview-side"><UploadPanel uploading={uploading} onUpload={(file) => void dashboard.uploadFile(file)} /><StorageNodes nodes={status?.nodes ?? []} onToggle={(node) => void dashboard.toggleNode(node)} /><ActivityPanel events={events} /></div>
      </div>
    </>}

    {view === 'files' && <div className="section-view files-view">
      <div className="section-intro"><div><p className="eyebrow">DATA PLACEMENT</p><h2>Files & topology</h2><p>Follow every chunk from its source file to healthy replicas on the storage nodes.</p></div><UploadPanel uploading={uploading} onUpload={(file) => void dashboard.uploadFile(file)} /></div>
      <FileTopologyPanel files={files} selected={selected} onSelect={(fileId) => void dashboard.selectFile(fileId)} onDelete={(file) => void dashboard.deleteFile(file)} />
    </div>}

    {view === 'nodes' && <div className="section-view"><div className="section-intro compact"><div><p className="eyebrow">INFRASTRUCTURE</p><h2>Storage nodes</h2><p>See capacity and simulate a node failure to watch replication recover.</p></div><button className="repair-button" onClick={() => void dashboard.repair()} disabled={repairing}><span>↻</span>{repairing ? 'Repairing...' : 'Repair replication'}</button></div><StorageNodes nodes={status?.nodes ?? []} onToggle={(node) => void dashboard.toggleNode(node)} /></div>}

    {view === 'activity' && <div className="section-view activity-view"><div className="section-intro compact"><div><p className="eyebrow">SYSTEM JOURNAL</p><h2>Activity & events</h2><p>A timeline of placement, node health, failures, and repairs from the coordinator.</p></div></div><ActivityPanel events={events} /></div>}
  </main>;
}
