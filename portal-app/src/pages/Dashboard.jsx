import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Badge, Page, Stat, State, fmtDate } from '../components/Page.jsx';
import Icon from '../components/Icon.jsx';

export default function Dashboard() {
  const stats = useAsync(() => api.guests.stats(), []);
  const events = useAsync(() => api.events.list({ limit: 12 }), []);

  const totals = stats.data?.totals || {};
  const byStatus = stats.data?.byStatus || [];
  const readers = stats.data?.readers || {};
  const buttons = stats.data?.buttons || [];
  const pct = (v) => `${Math.round(Number(v || 0))}%`;

  return (
    <Page title="Dashboard" actions={<button onClick={() => { stats.reload(); events.reload(); }} title="Refresh"><Icon name="rotate-right" /> Refresh</button>}>
      <State loading={stats.loading} error={stats.error}>
        <div className="stats">
          <Stat label="Guests" value={totals.total_guests} />
          <Stat label="Attending heads" value={totals.total_attending} />
          <Stat label="Opens" value={totals.total_opens} />
          <Stat label="Clicks" value={totals.total_clicks} />
        </div>

        <h2>How far they read</h2>
        <div className="stats">
          <Stat label="Opened the invitation" value={readers.opened ?? 0} />
          <Stat label="Reached halfway" value={readers.read_half ?? 0} />
          <Stat label="Read to the end" value={readers.read_to_end ?? 0} />
          <Stat label="Average depth" value={pct(totals.avg_scroll)} />
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Depth is the furthest point each invitation was ever scrolled to — the RSVP form sits at
          the bottom, so anyone short of about 90% never saw it.
        </p>

        <h2>What they pressed</h2>
        {buttons.length === 0 ? (
          <p className="empty">No buttons pressed yet.</p>
        ) : (
          <table>
            <thead><tr><th>Button</th><th>Presses</th><th /></tr></thead>
            <tbody>
              {buttons.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.presses}</td>
                  <td style={{ width: '45%' }}>
                    <span className="depth__bar" style={{ width: '100%' }}>
                      <span style={{ width: `${(Number(row.presses) / Number(buttons[0].presses)) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>RSVP breakdown</h2>
        <table>
          <thead><tr><th>Status</th><th>Guests</th><th>Heads</th></tr></thead>
          <tbody>
            {byStatus.map((row) => (
              <tr key={row.rsvp_status}>
                <td><Badge status={row.rsvp_status} /></td>
                <td>{row.guests}</td>
                <td>{row.heads ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </State>

      <h2>Recent activity</h2>
      <State loading={events.loading} error={events.error} empty={events.data?.length === 0}>
        <table>
          <thead><tr><th>When</th><th>Guest</th><th>Event</th><th>Device</th></tr></thead>
          <tbody>
            {(events.data || []).map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.created_at)}</td>
                <td>{e.slug ? <Link to={`/guests/${e.slug}`}>{e.slug}</Link> : '—'}</td>
                <td>{e.event_type}</td>
                <td>{e.device || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </State>
    </Page>
  );
}
