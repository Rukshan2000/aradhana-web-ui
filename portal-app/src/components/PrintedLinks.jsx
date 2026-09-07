import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { State, fmtDate } from './Page.jsx';
import { SITE_BASE } from '../lib/site.js';
import Icon from './Icon.jsx';
import { useDialogs } from './Dialog.jsx';

/**
 * Repairing invitation URLs that are already printed.
 *
 * The URL inside a QR code cannot be changed once the cards come back from
 * the printer — so when it stops resolving, the only end that can move is
 * this one. Each row here points a printed address at a live invitation.
 *
 * Renames add their own rows automatically (marked "rename"); the form is for
 * the addresses nobody can infer — a slug typed wrong at the print shop, or a
 * link written out from memory.
 */
export default function PrintedLinks({ wedding, guests = [] }) {
  const { alert, confirm } = useDialogs();
  const aliases = useAsync(
    () => (wedding ? api.weddings.aliases(wedding.slug) : Promise.resolve([])),
    [wedding?.slug],
  );

  const [url, setUrl] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  // A one-segment URL is the open link and needs no invitee; a two-segment one
  // has to say which guest it belongs to, since the printed slug is precisely
  // the part that no longer means anything.
  // Mirrors parseInviteUrl on the API: a leading domain is stripped whether or
  // not the pasted link kept its https://, so the segment count is the path's.
  const path = url.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^[a-z0-9-]+(\.[a-z0-9-]+)+/i, '');
  const needsTarget = path.split('/').filter(Boolean).length > 1;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.weddings.addAlias(wedding.slug, {
        url: url.trim(),
        ...(needsTarget ? { target } : {}),
      });
      setUrl('');
      setTarget('');
      aliases.reload();
    } catch (err) {
      await alert({ title: 'Could not map that URL', body: String(err.message || err), danger: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    if (!await confirm({
      title: 'Stop honouring this printed URL?',
      body: `${SITE_BASE}${row.path} goes back to showing "not found". Any card printed with it stops working. The invitation itself is untouched.`,
      confirmLabel: 'Remove mapping',
      danger: true,
    })) return;
    setRemoving(row.id);
    try {
      await api.weddings.removeAlias(wedding.slug, row.id);
      aliases.reload();
    } catch (err) {
      await alert({ title: 'Could not remove that mapping', body: String(err.message || err), danger: true });
    } finally {
      setRemoving(null);
    }
  }

  if (!wedding) return null;

  return (
    <>
      <p className="empty">
        A printed QR code holds its URL permanently — editing a slug here cannot reach the cards
        already in your guests' hands. Anything listed below keeps resolving anyway, so an old card
        still opens the right invitation. Renames are recorded for you; add the rest by hand.
      </p>

      <form className="card form" onSubmit={submit}>
        <div className="grid">
          <label>
            printed URL
            <input
              value={url}
              required
              placeholder={`${SITE_BASE}/${wedding.slug}/old-name`}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          {needsTarget && (
            <label>
              opens this invitee
              <select value={target} required onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choose an invitee…</option>
                {guests.map((g) => (
                  <option key={g.slug} value={g.slug}>{g.name} ({g.slug})</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button className="primary" type="submit" disabled={busy || !url.trim()}>
          <Icon name={busy ? 'spinner' : 'link'} /> {busy ? 'Mapping…' : 'Map this URL'}
        </button>
      </form>

      <State loading={aliases.loading} error={aliases.error} empty={!aliases.data?.length}>
        <table>
          <thead>
            <tr>
              <th>Printed address</th>
              <th>Now opens</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(aliases.data || []).map((row) => (
              <tr key={row.id}>
                <td>
                  <a href={`${SITE_BASE}${row.path}`} target="_blank" rel="noreferrer">
                    {row.path}
                  </a>
                </td>
                <td>
                  {row.kind === 'wedding'
                    ? <>the whole wedding <span className="muted">(every card under this name)</span></>
                    : <>{row.guest_name} <span className="muted">({row.guest_slug})</span></>}
                </td>
                <td>
                  {fmtDate(row.created_at)}{' '}
                  <span className="muted">
                    {row.source === 'manual' ? '· added by hand' : '· kept from a rename'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="qr-button danger"
                    disabled={removing === row.id}
                    onClick={() => remove(row)}
                    title="Stop honouring this printed URL"
                    aria-label="Stop honouring this printed URL"
                  >
                    <Icon name={removing === row.id ? 'spinner' : 'trash'} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </State>
    </>
  );
}
