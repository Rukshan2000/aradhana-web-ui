import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Page, State } from '../components/Page.jsx';
import { inviteUrl, openInviteUrl, qrTarget, qrLandingUrl } from '../lib/site.js';
import QrButton, { qrFilename } from '../components/QrButton.jsx';
import ContentEditor from '../components/ContentEditor.jsx';
import WeddingDetailsEditor from '../components/WeddingDetailsEditor.jsx';
import ChangeLink from '../components/ChangeLink.jsx';
import Icon from '../components/Icon.jsx';

const blank = { name: '', household: '', slug: '', side: '', email: '', phone: '', max_seats: 2 };

export default function WeddingDetail() {
  const { weddingSlug } = useParams();
  const wedding = useAsync(() => api.weddings.get(weddingSlug), [weddingSlug]);
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [added, setAdded] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // The slug is derived server-side when left blank; the code is always
      // assigned server-side and never sent from here.
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      const guest = await api.weddings.addGuest(weddingSlug, { ...payload, max_seats: Number(form.max_seats) || 2 });
      setForm(null);
      setAdded(guest);
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  const w = wedding.data;

  return (
    <Page
      title={w ? `${w.bride} & ${w.groom}` : weddingSlug}
      actions={
        <>
          {/* Opens the couple's own live site. Only offered once the wedding
              has loaded, since the URL is built from its slug. */}
          {w && (
            <a className="button" href={openInviteUrl(w.slug)} target="_blank" rel="noreferrer" title="Open your live invitation site">
              <Icon name="arrow-up-right-from-square" /> Preview site
            </a>
          )}
          <button onClick={() => wedding.reload()} title="Refresh"><Icon name="rotate-right" /> Refresh</button>
          <button className="primary" onClick={() => setForm(form ? null : blank)}>
            <Icon name={form ? 'xmark' : 'user-plus'} /> {form ? 'Cancel' : 'Add invitee'}
          </button>
        </>
      }
    >
      <State loading={wedding.loading} error={wedding.error}>
        {w && (
          <div className="card">
            <p>
              <strong>Invitation URL</strong> <code>{inviteUrl(w.slug, '<inviteeSlug>')}</code>{' '}
              {/* The first segment sits under every personalised link, so
                  changing it here moves the whole wedding at once. */}
              <ChangeLink
                kind="wedding"
                weddingSlug={w.slug}
                wedding={w}
                label="Change URL"
                onDone={(next) => navigate(`/weddings/${next}`, { replace: true })}
              />
            </p>
            <p>
              <strong>Open invitation</strong>{' '}
              {w.open_revoked_at ? (
                <span className="muted"><Icon name="unlink" /> revoked — <code>{openInviteUrl(w.slug)}</code> shows the closed-invitation page</span>
              ) : (
                <>
                  <a href={openInviteUrl(w.slug)} target="_blank" rel="noreferrer">{openInviteUrl(w.slug)}</a>{' '}
                  <QrButton url={qrTarget(w, openInviteUrl(w.slug), { weddingSlug: w.slug })} filename={qrFilename(w.slug)} label="Download QR" />
                </>
              )}
              <br />
              <span className="muted">
                One link for anyone without a personalised card — they type their own name, side, head count and phone.
                Revoke it from <Link to="/guests?tab=self">Well-wishers</Link>.
              </span>
            </p>
            <p className="muted">
              {[w.city, w.date_label, w.year_label, w.venue].filter(Boolean).join(' · ') || 'No details set yet.'}{' '}
              <WeddingDetailsEditor weddingSlug={weddingSlug} wedding={w} onSaved={() => wedding.reload()} />
            </p>
          </div>
        )}
      </State>

      {w && <ContentEditor weddingSlug={weddingSlug} content={w.content} />}

      {form && (
        <form className="card form" onSubmit={submit}>
          <div className="grid">
            <label>
              name *
              <input value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              url slug
              <input value={form.slug} placeholder="auto from name"
                onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </label>
            {['household', 'email', 'phone'].map((field) => (
              <label key={field}>
                {field}
                <input value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
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
          <button className="primary" disabled={saving}><Icon name="save" /> {saving ? 'Saving…' : 'Add invitee'}</button>
        </form>
      )}

      {added && (
        <p className="card">
          Added <strong>{added.name}</strong> — invitation link:{' '}
          <a href={inviteUrl(weddingSlug, added.slug)} target="_blank" rel="noreferrer">
            /{weddingSlug}/{added.slug}
          </a>{' '}
          <QrButton url={qrLandingUrl(weddingSlug, added.slug)} filename={qrFilename(weddingSlug, added.slug)} />
          . See it in <Link to={`/guests/${added.slug}?wedding=${weddingSlug}`}>Guests</Link>.
        </p>
      )}
    </Page>
  );
}
