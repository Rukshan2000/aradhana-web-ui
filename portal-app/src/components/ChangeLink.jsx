import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { SITE_BASE, qrLandingUrl } from '../lib/site.js';
import Icon from './Icon.jsx';

/** Same rules as the API's slugify, so the preview is what actually gets saved. */
export function slugify(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Changing the address an invitation answers on — and so the URL inside every
 * QR code generated from it.
 *
 * The old address is not thrown away: the API records it as an alias, so the
 * cards already printed with it keep opening the same invitation. That is the
 * whole reason this is safe to expose as a button rather than buried in a
 * warning, and the dialog says so plainly.
 *
 * `kind` is 'guest' for /<wedding>/<invitee> or 'wedding' for the first
 * segment, which every personalised link sits under.
 */
export default function ChangeLink({
  kind,
  weddingSlug,
  guest = null,
  wedding = null,
  onDone,
  label = 'Change link',
  iconOnly = false,
}) {
  const record = kind === 'guest' ? guest : wedding;
  const current = kind === 'guest' ? guest.slug : weddingSlug;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  // The QR override, kept separate from the address: an empty box means "use
  // the invitation URL", which is what all but a handful of codes want.
  const [qr, setQr] = useState(record?.qr_url || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      input.current?.focus();
      input.current?.select();
    }
    if (!open && el.open) el.close();
  }, [open]);

  function start() {
    setValue(current);
    setQr(record?.qr_url || '');
    setError(null);
    setOpen(true);
  }

  const next = slugify(value);
  const qrNext = qr.trim();
  const qrWas = record?.qr_url || '';
  const unchanged = next === current && qrNext === qrWas;
  const preview = kind === 'guest'
    ? `${SITE_BASE}/${weddingSlug}/${next || '…'}`
    : `${SITE_BASE}/${next || '…'}`;
  // What the code itself carries, as against the address it ends up at: the
  // fixed /go/ page, which looks the current address up when it is scanned.
  const qrPreview = kind === 'guest'
    ? qrLandingUrl(weddingSlug, next || '…')
    : qrLandingUrl(next || '…');

  async function save(e) {
    e.preventDefault();
    if (!next || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      // Both halves travel in one PATCH, so a slug change and a new QR target
      // can never half-apply and leave the printed code pointing at neither.
      const fields = { slug: next, ...(qrNext !== qrWas ? { qr_url: qrNext } : {}) };
      if (kind === 'guest') {
        await api.guests.update(guest.slug, fields, weddingSlug);
      } else {
        await api.weddings.update(weddingSlug, fields);
      }
      setOpen(false);
      onDone?.(next);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={iconOnly ? 'qr-button' : ''}
        onClick={start}
        title={`Change the URL this QR code points to (currently /${kind === 'guest' ? `${weddingSlug}/${current}` : current})`}
        aria-label={label}
      >
        <Icon name="pen" />{!iconOnly && ` ${label}`}
      </button>

      <dialog
        ref={ref}
        className="dialog"
        onCancel={(e) => { e.preventDefault(); setOpen(false); }}
        onClick={(e) => { if (e.target === ref.current) setOpen(false); }}
      >
        <form className="dialog__panel" onSubmit={save}>
          <h2 className="dialog__title">
            {kind === 'guest' ? `Change ${guest.name}'s link` : 'Change the wedding link'}
          </h2>

          <p className="dialog__body">
            This is the address the QR code encodes. Cards already printed with the
            old one keep working — it is kept as an alias and listed under{' '}
            <strong>Printed QR</strong>, where you can remove it once the old cards
            are out of circulation.
            {kind === 'wedding' && ' Changing this moves every personalised invitation too.'}
          </p>

          <label className="change-link__field">
            {kind === 'guest' ? 'invitee slug' : 'wedding slug'}
            <input
              ref={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={current}
            />
          </label>

          <p className="dialog__body">
            <span className="muted">was</span>{' '}
            <code>{kind === 'guest' ? `/${weddingSlug}/${current}` : `/${current}`}</code>
            <br />
            <span className="muted">now</span> <code>{preview.replace(SITE_BASE, '')}</code>
          </p>

          <label className="change-link__field">
            QR code points to <span className="muted">— leave empty to use the fixed /go/ page</span>
            <input
              value={qr}
              placeholder={qrPreview}
              onChange={(e) => setQr(e.target.value)}
            />
          </label>

          <p className="dialog__body">
            {qrNext ? (
              <>
                <Icon name="qrcode" /> The downloaded code will encode{' '}
                <code>{qrNext}</code>.{' '}
                {!qrNext.startsWith(SITE_BASE) && (
                  <strong>
                    That is outside your invitation site, so the card will not open this
                    invitation and its opens will not be tracked.
                  </strong>
                )}
              </>
            ) : (
              <>
                <Icon name="qrcode" /> The downloaded code will encode{' '}
                <code>{qrPreview}</code> — a fixed page that looks this
                invitation's current address up every time it is scanned, so
                renaming the link again re-aims the cards already printed
                rather than breaking them.
              </>
            )}
          </p>

          {error && <p className="error">{String(error.message || error)}</p>}

          <div className="dialog__actions">
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary" type="submit" disabled={busy || !next || unchanged}>
              <Icon name={busy ? 'spinner' : 'check'} /> {busy ? 'Saving…' : 'Change link'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
