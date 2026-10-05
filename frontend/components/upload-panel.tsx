import type { ChangeEvent } from 'react';
import { Panel, PanelHeading } from './dashboard-ui';

export function UploadPanel({ uploading, onUpload }: { uploading: boolean; onUpload: (file: File) => void }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
  };

  return <Panel className="upload-panel">
    <PanelHeading title="Add a file" detail="fixed-size chunking / 2 replicas" />
    <label className={`dropzone ${uploading ? 'is-uploading' : ''}`}>
      <input type="file" disabled={uploading} onChange={handleChange} />
      <span className="upload-icon">↑</span><strong>{uploading ? 'Placing chunks...' : 'Choose a file to upload'}</strong><small>Data stays on this machine</small>
    </label>
  </Panel>;
}
