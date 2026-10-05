'use client';

import { ActivityPanel } from '../components/activity-panel';
import { DashboardHeader, Intro, Metric, Notice } from '../components/dashboard-ui';
import { FileTopologyPanel } from '../components/file-topology';
import { StorageNodes } from '../components/storage-nodes';
import { UploadPanel } from '../components/upload-panel';
import { useDashboard } from '../hooks/use-dashboard';

export default function Home() {
  const dashboard = useDashboard();
  const { status, files, events, selected, uploading, repairing, message, setMessage } = dashboard;

  return <main className="shell">
    <DashboardHeader />
    <Intro repairing={repairing} onRepair={() => void dashboard.repair()} />
    {message && <Notice message={message} onDismiss={() => setMessage('')} />}

    <section className="metrics">
      <Metric label="Files" value={status?.totalFiles ?? 0} />
      <Metric label="Chunks" value={status?.totalChunks ?? 0} />
      <Metric label="Replicas" value={status?.totalReplicas ?? 0} />
      <Metric label="Healthy nodes" value={status ? `${status.healthyNodes}/${status.nodes.length}` : '—'} accent={status?.healthyNodes === status?.nodes.length} />
    </section>

    <div className="workspace-grid">
      <StorageNodes nodes={status?.nodes ?? []} onToggle={(node) => void dashboard.toggleNode(node)} />
      <UploadPanel uploading={uploading} onUpload={(file) => void dashboard.uploadFile(file)} />
    </div>

    <div className="content-grid">
      <FileTopologyPanel files={files} selected={selected} onSelect={(fileId) => void dashboard.selectFile(fileId)} onDelete={(file) => void dashboard.deleteFile(file)} />
      <ActivityPanel events={events} />
    </div>
  </main>;
}
