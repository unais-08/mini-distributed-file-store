import type { ActivityEvent } from '../lib/types';
import { formatTime } from '../lib/utils';
import { Panel, PanelHeading } from './dashboard-ui';

export function ActivityPanel({ events }: { events: ActivityEvent[] }) {
  return <Panel className="activity-panel">
    <PanelHeading title="Activity" detail="coordinator event stream" />
    <div className="activity-list">{events.length === 0 ? <div className="empty">Waiting for system events.</div> : events.slice(0, 8).map((event) => <div className="event" key={event.id}><time>{formatTime(event.createdAt)}</time><span>{event.message}</span></div>)}</div>
  </Panel>;
}
