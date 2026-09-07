import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Badge, Page, State, fmtDate } from '../components/Page.jsx';
import { inviteUrl, qrTarget } from '../lib/site.js';
import QrButton, { qrFilename } from '../components/QrButton.jsx';
import ChangeLink from '../components/ChangeLink.jsx';
import Icon from '../components/Icon.jsx';
import Pagination, { usePagination } from '../components/Pagination.jsx';
import { EventDetail, EventType } from './Events.jsx';

export default function GuestDetail() {
  const { slug } = useParams();
  // Guest slugs are unique per wedding, so the wedding travels in the query
  // string from wherever this page was linked.
  const [params] = useSearchParams();
  const wedding = params.get('wedding') || undefined;
  const navigate = useNavigate();
  const guest = useAsync(() => api.guests.get(slug, wedding), [slug, wedding]);
  const events = useAsync(() => api.events.list({ slug, wedding, limit: 100 }), [slug, wedding]);

  const [rsvp, setRsvp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    if (!guest.data) return;
    const g = guest.data;
    setRsvp({
      rsvp_status: g.rsvp_status,
      attending_count: g.attending_count,
      adults_count: g.adults_count,
      kids_count: g.kids_count,
      dietary: g.dietary || '',
      message: g.message || '',
    });
  }, [guest.data]);

  async function saveRsvp(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.guests.rsvp(slug, {
        ...rsvp,
        attending_count: Number(rsvp.attending_count) || 0,
        adults_count: Number(rsvp.adults_count) || 0,
        kids_count: Number(rsvp.kids_count) || 0,
      }, wedding);
      guest.reload(); events.reload();
    } catch (e2) { setErr(e2); } finally { setBusy(false); }
  }

  async function uploadPhoto(e) {
    e.preventDefault();
    if (!photo) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', photo);
      fd.append('category', 'guest');
      fd.append('slug', slug);
      await api.images.upload(fd);
      setPhoto(null);
      e.target.reset();
      guest.reload();
    } catch (e2) { setErr(e2); } finally { setBusy(false); }
  }

  // The click log rolled up per button: the couple wants "they opened the map
  // twice", not twelve rows to read in sequence.
  const pressed = useMemo(() => {
    const by = new Map();
    for (const e of events.data || []) {
      const label = e.event_type === 'click' && e.meta?.label;
      if (!label) continue;
      const row = by.get(label) || { label, count: 0, last: e.created_at };
      row.count += 1;
      if (new Date(e.created_at) > new Date(row.last)) row.last = e.created_at;
      by.set(label, row);
    }
    return [...by.values()].sort((a, b) => b.count - a.count);
  }, [events.data]);

  const eventPager = usePagination(events.data, slug);

  const g = guest.data;

  return (
    <Page title={g ? g.name : slug} actions={<Link className="button" to="/guests"><Icon name="arrow-left" /> All invitees</Link>}>
      <State loading={guest.loading} error={guest.error}>
        {g && (
          <>
            <div className="card detail">
              {g.photo_url && <img className="avatar" src={g.photo_url} alt={g.name} />}
              <dl>
                <dt>Slug</dt><dd>{g.slug}</dd>
                <dt>Invitation</dt><dd>
                  {!g.wedding_slug ? '—' : g.revoked_at ? (
                    <span className="muted">
                      <Icon name="unlink" /> <code>/{g.wedding_slug}/{g.slug}</code> revoked {fmtDate(g.revoked_at)}
                      {' — '}restore it from <Link to="/guests">the guest list</Link>.
                    </span>
                  ) : (
                    <>
                      <a href={inviteUrl(g.wedding_slug, g.slug)} target="_blank" rel="noreferrer">/{g.wedding_slug}/{g.slug}</a>{' '}
                      <QrButton
                        url={qrTarget(g, inviteUrl(g.wedding_slug, g.slug), { weddingSlug: g.wedding_slug, inviteeSlug: g.slug })}
                        filename={qrFilename(g.wedding_slug, g.slug)}
                      />{' '}
                      <ChangeLink
                        kind="guest"
                        weddingSlug={g.wedding_slug}
                        guest={g}
                        // The slug is this page's own address, so the new one
                        // has to be walked to rather than reloaded into.
                        onDone={(next) => navigate(
                          `/guests/${next}${wedding ? `?wedding=${wedding}` : ''}`,
                          { replace: true },
                        )}
                      />
                    </>
                  )}
                </dd>
                <dt>Household</dt><dd>{g.household || '—'}</dd>
                <dt>Side</dt><dd>{g.side || '—'}</dd>
                <dt>Email</dt><dd>{g.email || '—'}</dd>
                <dt>Phone</dt><dd>{g.phone || '—'}</dd>
                <dt>RSVP</dt><dd><Badge status={g.rsvp_status} /></dd>
                <dt>Seats</dt><dd>{g.attending_count} of {g.max_seats}</dd>
                <dt>Opens</dt><dd>{g.open_count} (first {fmtDate(g.first_opened_at)}, last {fmtDate(g.last_opened_at)})</dd>
                <dt>Read</dt><dd>
                  {g.open_count ? (
                    <span className="depth">
                      <span className="depth__bar"><span style={{ width: `${g.max_scroll || 0}%` }} /></span>
                      {g.max_scroll || 0}% of the invitation
                    </span>
                  ) : <span className="muted">not opened yet</span>}
                </dd>
                <dt>Clicks</dt><dd>{g.click_count}</dd>
                <dt>Responded</dt><dd>{fmtDate(g.responded_at)}</dd>
              </dl>
            </div>

            {rsvp && (
              <form className="card form" onSubmit={saveRsvp}>
                <h2>Update RSVP</h2>
                <div className="grid">
                  <label>
                    status
                    <select value={rsvp.rsvp_status} onChange={(e) => setRsvp({ ...rsvp, rsvp_status: e.target.value })}>
                      {['pending', 'attending', 'declined', 'maybe'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  {['attending_count', 'adults_count', 'kids_count'].map((f) => (
                    <label key={f}>
                      {f.replace('_', ' ')}
                      <input type="number" min="0" value={rsvp[f]} onChange={(e) => setRsvp({ ...rsvp, [f]: e.target.value })} />
                    </label>
                  ))}
                  <label>dietary<input value={rsvp.dietary} onChange={(e) => setRsvp({ ...rsvp, dietary: e.target.value })} /></label>
                  <label>message<input value={rsvp.message} onChange={(e) => setRsvp({ ...rsvp, message: e.target.value })} /></label>
                </div>
                <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save RSVP'}</button>
              </form>
            )}

            <form className="card form" onSubmit={uploadPhoto}>
              <h2>Guest photo</h2>
              <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              <button className="primary" disabled={busy || !photo}>Upload</button>
            </form>

            {err && <p className="error">{String(err.message)}</p>}
          </>
        )}
      </State>

      {pressed.length > 0 && (
        <>
          <h2>What they pressed</h2>
          <table>
            <thead><tr><th>Button</th><th>Times</th><th>Last</th></tr></thead>
            <tbody>
              {pressed.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td>{p.count}</td>
                  <td>{fmtDate(p.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Events</h2>
      <State loading={events.loading} error={events.error} empty={events.data?.length === 0}>
        <Pagination {...eventPager} unit="events" />
        <table>
          <thead><tr><th>When</th><th>Type</th><th>Details</th><th>Device</th><th>IP</th><th>URL</th></tr></thead>
          <tbody>
            {eventPager.slice.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.created_at)}</td>
                <td><EventType type={e.event_type} /></td>
                <td><EventDetail event={e} /></td>
                <td>{e.device || '—'}</td>
                <td>{e.ip || '—'}</td>
                <td className="truncate">{e.url || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination {...eventPager} unit="events" />
      </State>
    </Page>
  );
}
