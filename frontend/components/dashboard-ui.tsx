import type { ReactNode } from 'react';

export type DashboardView = 'overview' | 'files' | 'nodes' | 'activity';

export function PanelHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="panel-heading"><h2>{title}</h2><span>{detail}</span></div>;
}

export function Metric({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return <div className="metric"><span>{label}</span><strong className={accent ? 'accent' : ''}>{value}</strong></div>;
}

export function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="notice">{message}<button onClick={onDismiss} aria-label="Dismiss message">×</button></div>;
}

export function DashboardHeader({ activeView, onViewChange }: { activeView: DashboardView; onViewChange: (view: DashboardView) => void }) {
  const views: Array<{ id: DashboardView; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'files', label: 'Files & topology' },
    { id: 'nodes', label: 'Storage nodes' },
    { id: 'activity', label: 'Activity' },
  ];

  return <header className="topbar">
    <div className="brand"><span className="brand-mark">M</span><div><strong>MiniDFS</strong><span>distributed storage lab</span></div></div>
    <div className="topbar-right">
      <nav className="view-nav" aria-label="Dashboard sections">
        {views.map((view) => <button key={view.id} className={activeView === view.id ? 'active' : ''} onClick={() => onViewChange(view.id)}>{view.label}</button>)}
      </nav>
      <div className="connection"><span className="pulse" /> coordinator connected</div>
    </div>
  </header>;
}

export function Intro({ repairing, onRepair }: { repairing: boolean; onRepair: () => void }) {
  return <section className="intro">
    <div><p className="eyebrow">SYSTEM CONTROL PLANE / LOCAL SIMULATION</p><h1>See where your data lives.</h1><p className="lede">Chunk placement, replica health, and failure recovery in one quiet little distributed system.</p></div>
    <button className="repair-button" onClick={onRepair} disabled={repairing}><span>↻</span>{repairing ? 'Repairing...' : 'Repair replication'}</button>
  </section>;
}

export function Panel({ children, className }: { children: ReactNode; className: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
