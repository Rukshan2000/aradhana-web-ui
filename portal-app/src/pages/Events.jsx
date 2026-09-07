import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Page, State, fmtDate } from '../components/Page.jsx';
import Icon from '../components/Icon.jsx';
import Pagination, { usePagination } from '../components/Pagination.jsx';

/** What an event actually says: how far they read, which button they pressed. */
export function EventDetail({ event }) {
  const meta = event.meta || {};
  if (event.event_type === 'scroll' && meta.depth != null) {
    return (
      <span className="depth">
        <span className="depth__bar"><span style={{ width: `${meta.depth}%` }} /></span>
        {meta.depth}%
      </span>
    );
  }
  if (meta.label) return <span>{meta.label}</span>;
  if (event.event_type === 'rsvp') {
    return <span className="muted">{meta.rsvp_status || 'replied'}{meta.attending_count != null ? ` · ${meta.attending_count}` : ''}</span>;
  }
  return <span className="muted">—</span>;
}

const TYPE_ICON = { open: 'envelope-open', click: 'hand-pointer', scroll: 'arrow-down', rsvp: 'reply', view: 'eye' };

export function EventType({ type }) {
  return <span className="event-type"><Icon name={TYPE_ICON[type] || 'circle'} /> {type}</span>;
}

export default function Events() {
  const [filters, setFilters] = useState({ slug: '', event_type: '', limit: 500 });
  const [applied, setApplied] = useState(filters);
  const { data, error, loading, reload } = useAsync(
    () => api.events.list({ slug: applied.slug || undefined, event_type: applied.event_type || undefined, limit: applied.limit }),
    [applied],
  );

  // A new filter is a new list: `applied` in the signature sends the reader
  // back to page 1 rather than leaving them on a page that no longer exists.
  const pager = usePagination(data, JSON.stringify(applied));

  return (
    <Page title="Events" actions={<button onClick={reload} title="Refresh"><Icon name="rotate-right" /> Refresh</button>}>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}>
        <input placeholder="Filter by slug" value={filters.slug} onChange={(e) => setFilters({ ...filters, slug: e.target.value })} />
        <select value={filters.event_type} onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}>
          <option value="">All types</option>
          {['open', 'click', 'rsvp', 'view'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="filters__limit">
          Load up to
          <input type="number" min="1" max="2000" value={filters.limit}
            onChange={(e) => setFilters({ ...filters, limit: Number(e.target.value) })} />
        </label>
        <button className="primary"><Icon name="filter" /> Apply</button>
      </form>

      <State loading={loading} error={error} empty={data?.length === 0}>
        <Pagination {...pager} unit="events" />
        <table>
          <thead><tr><th>When</th><th>Guest</th><th>Type</th><th>Details</th><th>Device</th><th>IP</th><th>Referer</th><th>URL</th></tr></thead>
          <tbody>
            {pager.slice.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.created_at)}</td>
                <td>{e.slug ? <Link to={`/guests/${e.slug}`}>{e.slug}</Link> : '—'}</td>
                <td><EventType type={e.event_type} /></td>
                <td><EventDetail event={e} /></td>
                <td>{e.device || '—'}</td>
                <td>{e.ip || '—'}</td>
                <td className="truncate">{e.referer || '—'}</td>
                <td className="truncate">{e.url || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination {...pager} unit="events" />
      </State>
    </Page>
  );
}
