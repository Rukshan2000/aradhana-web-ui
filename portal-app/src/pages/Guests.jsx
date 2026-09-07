import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Badge, Page, State, fmtDate } from '../components/Page.jsx';
import { inviteUrl, openInviteUrl, qrTarget } from '../lib/site.js';
import QrButton, { qrFilename } from '../components/QrButton.jsx';
import Icon from '../components/Icon.jsx';
import Pagination, { usePagination } from '../components/Pagination.jsx';
import { useDialogs } from '../components/Dialog.jsx';
import PrintedLinks from '../components/PrintedLinks.jsx';
import ChangeLink from '../components/ChangeLink.jsx';

const blank = { slug: '', name: '', household: '', side: '', email: '', phone: '', max_seats: 2 };

/* Two kinds of row live in the same table: households the couple invited by
   name, each with their own /<wedding>/<invitee> link, and the well-wishers
   who replied through the open /<wedding> link and created their own row.
   They are managed differently — one is addressed in advance, the other only
   ever arrives already-answered — so they get a tab each. */
const TABS = [
  ['invited', 'Invitees', 'envelope-open-text'],
  ['self', 'Well-wishers', 'user-check'],
  // Cards that are already printed outlive any slug edit made here, so the
  // URLs on them get a tab of their own rather than hiding inside a row.
  ['printed', 'Printed QR', 'qrcode'],
];

/** The link column: visit, QR, and the revoke switch — or, once revoked, why
 *  the URL is dead and the one button that brings it back. */
function LinkCell({ guest, busy, onToggle, onChanged }) {
  if (!guest.wedding_slug) return '—';
  const url = inviteUrl(guest.wedding_slug, guest.slug);
  const revoked = Boolean(guest.revoked_at);
  return (
    <div className="link-cell">
      {revoked ? (
        <span className="muted" title={`Revoked ${fmtDate(guest.revoked_at)}`}>
          <Icon name="unlink" /> revoked
        </span>
      ) : (
        <>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="icon-link"
            title="Open this invitation"
            aria-label="Open this invitation"
          >
            <Icon name="up-right-from-square" />
          </a>
          <QrButton url={qrTarget(guest, url, { weddingSlug: guest.wedding_slug, inviteeSlug: guest.slug })} filename={qrFilename(guest.wedding_slug, guest.slug)} />
          <ChangeLink
            kind="guest"
            weddingSlug={guest.wedding_slug}
            guest={guest}
            onDone={onChanged}
            iconOnly
          />
        </>
      )}
      <button
        type="button"
        className={`qr-button${revoked ? '' : ' danger'}`}
        disabled={busy}
        onClick={() => onToggle(guest)}
        title={revoked ? 'Restore this invitation link' : 'Revoke this invitation link'}
        aria-label={revoked ? 'Restore this invitation link' : 'Revoke this invitation link'}
      >
        <Icon name={busy ? 'spinner' : revoked ? 'undo' : 'unlink'} />
      </button>
    </div>
  );
}

export default function Guests() {
  // One request for both tabs: switching is instant and each tab's count is
  // known without asking the API twice.
  const { data, error, loading, reload } = useAsync(() => api.guests.list(), []);
  // A user manages at most one wedding — this is only to know whether it
  // exists yet, not to offer a choice of which one a guest belongs to.
  const weddings = useAsync(() => api.weddings.list(), []);
  const myWedding = weddings.data?.[0] || null;

  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'self' ? 'self' : 'invited';
  const setTab = (next) => setParams(next === 'invited' ? {} : { tab: next }, { replace: true });

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [copied, setCopied] = useState(false);
  const { confirm, alert } = useDialogs();

  // Rows written before the source column existed are invitees: they can only
  // have come from the portal, since the open link did not exist yet.
  const sourceOf = (g) => (g.source === 'self' ? 'self' : 'invited');
  const counts = useMemo(() => {
    const all = data || [];
    return { invited: all.filter((g) => sourceOf(g) === 'invited').length, self: all.filter((g) => sourceOf(g) === 'self').length };
  }, [data]);

  const guests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data || []).filter((g) => {
      if (sourceOf(g) !== tab) return false;
      if (status && g.rsvp_status !== status) return false;
      if (!q) return true;
      return [g.name, g.slug, g.email, g.phone].some((v) => v?.toLowerCase().includes(q));
    });
  }, [data, query, status, tab]);

  // Tab, search and status filter all change which list is being read, so
  // each of them returns the reader to page 1.
  const pager = usePagination(guests, `${tab}|${query}|${status}`);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.guests.create({ ...form, max_seats: Number(form.max_seats) || 2, side: form.side || null });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  // Self-registered rows are the only ones worth deleting from here: a
  // mistyped or duplicate walk-in reply, which the couple never entered and
  // cannot correct by re-sending an invitation.
  async function remove(guest) {
    const yes = await confirm({
      title: `Remove ${guest.name}'s reply?`,
      body: 'Their reply, head count and phone number are deleted for good. This cannot be undone.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!yes) return;
    setRemoving(guest.slug);
    try {
      await api.guests.remove(guest.slug);
      reload();
    } catch (err) {
      await alert({ title: 'Could not remove that reply', body: String(err.message || err), danger: true });
    } finally {
      setRemoving(null);
    }
  }

  // Revoking retires the URL and keeps the guest: their reply, opens and
  // history all stay, and restoring hands back the same address rather than
  // a new one, so a link already printed on a card still works.
  async function toggleRevoke(guest) {
    const revoked = Boolean(guest.revoked_at);
    if (!revoked && !await confirm({
      title: `Revoke ${guest.name}'s invitation link?`,
      body: `Anyone opening ${inviteUrl(guest.wedding_slug, guest.slug)} sees a closed-invitation page until you restore it. Their reply and history are kept.`,
      confirmLabel: 'Revoke link',
      danger: true,
    })) return;
    setRevoking(guest.slug);
    try {
      await (revoked ? api.guests.restore(guest.slug) : api.guests.revoke(guest.slug));
      reload();
    } catch (err) {
      await alert({ title: 'Could not change that link', body: String(err.message || err), danger: true });
    } finally {
      setRevoking(null);
    }
  }

  async function toggleOpenLink() {
    const revoked = Boolean(myWedding.open_revoked_at);
    if (!revoked && !await confirm({
      title: 'Revoke the open invitation link?',
      body: 'Anyone who already has it — including printed QR codes — sees a closed-invitation page until you restore it. Replies already collected are kept.',
      confirmLabel: 'Revoke link',
      danger: true,
    })) return;
    setRevoking('__open__');
    try {
      await (revoked
        ? api.weddings.restoreOpenLink(myWedding.slug)
        : api.weddings.revokeOpenLink(myWedding.slug));
      weddings.reload();
    } catch (err) {
      await alert({ title: 'Could not change that link', body: String(err.message || err), danger: true });
    } finally {
      setRevoking(null);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(openInviteUrl(myWedding.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Page
      title={{ self: 'Well-wishers', printed: 'Printed QR codes' }[tab] || 'Invitees'}
      actions={
        <>
          <button onClick={reload} title="Refresh"><Icon name="rotate-right" /> Refresh</button>
          {tab === 'invited' && (
            <button className="primary" disabled={!myWedding} onClick={() => setForm(form ? null : blank)}>
              <Icon name={form ? 'xmark' : 'user-plus'} /> {form ? 'Cancel' : 'Add invitee'}
            </button>
          )}
        </>
      }
    >
      <div className="content-tabs">
        {TABS.map(([key, label, icon]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <Icon name={icon} /> {label}
            {counts[key] !== undefined && <span className="muted"> ({counts[key]})</span>}
          </button>
        ))}
      </div>

      {!weddings.loading && !myWedding && (
        <p className="empty">
          <Link to="/weddings">Create your wedding</Link> before adding invitees.
        </p>
      )}

      {tab === 'self' && myWedding && (
        <p className={`empty${myWedding.open_revoked_at ? ' link-revoked' : ''}`}>
          {myWedding.open_revoked_at ? (
            <>
              <Icon name="unlink" /> The open link <code>{openInviteUrl(myWedding.slug)}</code> is
              revoked — it has shown the closed-invitation page since {fmtDate(myWedding.open_revoked_at)}.
              Replies already collected are untouched.{' '}
            </>
          ) : (
            <>
              Anyone you send{' '}
              <a href={openInviteUrl(myWedding.slug)} target="_blank" rel="noreferrer">
                {openInviteUrl(myWedding.slug)}
              </a>{' '}
              can reply here with their name, side, head count and phone number.{' '}
              <button onClick={copyLink} title="Copy the open invitation link">
                <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copied' : 'Copy link'}
              </button>{' '}
              <QrButton
                url={qrTarget(myWedding, openInviteUrl(myWedding.slug), { weddingSlug: myWedding.slug })}
                filename={qrFilename(myWedding.slug)}
                label="Download QR"
              />{' '}
              <ChangeLink
                kind="wedding"
                weddingSlug={myWedding.slug}
                wedding={myWedding}
                label="Change URL"
                onDone={() => weddings.reload()}
              />{' '}
            </>
          )}
          <button
            className={myWedding.open_revoked_at ? '' : 'danger'}
            disabled={revoking === '__open__'}
            onClick={toggleOpenLink}
          >
            <Icon name={myWedding.open_revoked_at ? 'undo' : 'unlink'} />{' '}
            {revoking === '__open__'
              ? 'Working…'
              : myWedding.open_revoked_at ? 'Restore link' : 'Revoke link'}
          </button>
        </p>
      )}

      {tab === 'invited' && form && myWedding && (
        <form className="card form" onSubmit={submit}>
          <div className="grid">
            {['slug', 'name', 'household', 'email', 'phone'].map((field) => (
              <label key={field}>
                {field}
                <input
                  value={form[field]}
                  required={['slug', 'name'].includes(field)}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              </label>
            ))}
            <label>
              side
              <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}>
                <option value="">—</option>
                <option value="bride">bride</option>
                <option value="groom">groom</option>
              </select>
            </label>
            <label>
              max seats
              <input type="number" min="0" value={form.max_seats}
                onChange={(e) => setForm({ ...form, max_seats: e.target.value })} />
            </label>
          </div>
          {formError && <p className="error">{String(formError.message)}</p>}
          <button className="primary" disabled={saving}>
            <Icon name="save" /> {saving ? 'Saving…' : 'Create invitee'}
          </button>
        </form>
      )}

      {tab === 'printed' && myWedding && (
        <PrintedLinks wedding={myWedding} guests={(data || []).filter((g) => sourceOf(g) === 'invited')} />
      )}

      {tab !== 'printed' && (
        <>
        <div className="filters">
          <input
            placeholder={tab === 'self' ? 'Search name, phone…' : 'Search name, slug, email…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['pending', 'attending', 'declined', 'maybe'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <State
          loading={loading}
          error={error}
          empty={!loading && guests.length === 0}
        >
          <Pagination {...pager} unit={tab === 'self' ? 'well-wishers' : 'invitees'} />
          {tab === 'self' ? (
            <table>
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Side</th><th>RSVP</th><th>Attending</th><th>Replied</th><th>Note</th><th>Link</th><th /></tr>
              </thead>
              <tbody>
                {pager.slice.map((g) => (
                  <tr key={g.id} className={g.revoked_at ? 'row-revoked' : ''}>
                    <td><Link to={`/guests/${g.slug}`}>{g.name}</Link></td>
                    <td>{g.phone ? <a href={`tel:${g.phone.replace(/\s/g, '')}`}>{g.phone}</a> : '—'}</td>
                    <td>{g.side || '—'}</td>
                    <td><Badge status={g.rsvp_status} /></td>
                    <td>{g.attending_count}</td>
                    <td>{fmtDate(g.responded_at)}</td>
                    <td className="muted">{g.message || '—'}</td>
                    <td><LinkCell guest={g} busy={revoking === g.slug} onToggle={toggleRevoke} onChanged={reload} /></td>
                    <td>
                      <button className="danger" disabled={removing === g.slug} onClick={() => remove(g)}>
                        <Icon name="trash-can" /> {removing === g.slug ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th>Side</th><th>RSVP</th><th>Seats</th><th>Opens</th><th>Clicks</th><th>Link</th></tr>
              </thead>
              <tbody>
                {pager.slice.map((g) => (
                  <tr key={g.id} className={g.revoked_at ? 'row-revoked' : ''}>
                    <td>
                      <Link to={`/guests/${g.slug}`}>{g.name}</Link>{' '}
                      <span className="muted">{g.household}</span>
                    </td>
                    <td>{g.side || '—'}</td>
                    <td><Badge status={g.rsvp_status} /></td>
                    <td>{g.attending_count}/{g.max_seats}</td>
                    <td>{g.open_count}</td>
                    <td>{g.click_count}</td>
                    <td><LinkCell guest={g} busy={revoking === g.slug} onToggle={toggleRevoke} onChanged={reload} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pagination {...pager} unit={tab === 'self' ? 'well-wishers' : 'invitees'} />
        </State>
        </>
      )}
    </Page>
  );
}
