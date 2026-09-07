import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import Icon from './Icon.jsx';

/** The couple/date/venue fields that make up a wedding row itself — as
    against everything in `ContentEditor`, which lives in `weddings.content`. */
const EMPTY = {
  bride: '', groom: '', hashtag: '', city: '', venue: '',
  event_date: '', date_label: '', year_label: '', reply_by: '',
  notes: '', published: true, open_rsvp: false,
};

/** `event_date` is stored as a timestamp but edited with a
    `datetime-local` input, which wants "YYYY-MM-DDTHH:mm" in local time
    with no offset — so this trims the ISO string down rather than
    reparsing it, which would shift the printed time by the browser's zone. */
const toInputValue = (isoLike) => {
  if (!isoLike) return '';
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromWedding = (wedding) => ({
  bride: wedding?.bride ?? '',
  groom: wedding?.groom ?? '',
  hashtag: wedding?.hashtag ?? '',
  city: wedding?.city ?? '',
  venue: wedding?.venue ?? '',
  event_date: toInputValue(wedding?.event_date),
  date_label: wedding?.date_label ?? '',
  year_label: wedding?.year_label ?? '',
  reply_by: wedding?.reply_by ?? '',
  notes: wedding?.notes ?? '',
  published: wedding?.published ?? true,
  open_rsvp: wedding?.open_rsvp ?? false,
});

/**
 * The couple/date/venue fields, edited in a popup — as against `ContentEditor`,
 * which is a full page of tabs for the invitation's photos and wording and
 * stays inline since there is too much of it for a dialog to hold well.
 */
export default function WeddingDetailsEditor({ weddingSlug, wedding, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const first = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      first.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  function start() {
    setForm(fromWedding(wedding));
    setError(null);
    setOpen(true);
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // A blank date clears the field; anything else is sent as-is and the
      // server stores it as a timestamp.
      const payload = { ...form, event_date: form.event_date || null };
      const next = await api.weddings.update(weddingSlug, payload);
      setOpen(false);
      onSaved?.(next);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={start}>
        <Icon name="pen" /> Edit details
      </button>

      <dialog
        ref={ref}
        className="dialog dialog--wide"
        onCancel={(e) => { e.preventDefault(); setOpen(false); }}
        onClick={(e) => { if (e.target === ref.current) setOpen(false); }}
      >
        <form className="dialog__panel" onSubmit={save}>
          <h2 className="dialog__title">Wedding details</h2>
          <p className="dialog__body" style={{ marginBottom: 18 }}>
            The couple, the date and the venue — everything printed on the invitation itself besides its photos and story.
          </p>

          <div className="grid">
            <label>
              Bride's name *
              <input ref={first} value={form.bride} required onChange={(e) => set('bride', e.target.value)} />
            </label>
            <label>
              Groom's name *
              <input value={form.groom} required onChange={(e) => set('groom', e.target.value)} />
            </label>
            <label>
              Hashtag
              <input value={form.hashtag} placeholder="#BrideAndGroom" onChange={(e) => set('hashtag', e.target.value)} />
            </label>
            <label>
              City
              <input value={form.city} onChange={(e) => set('city', e.target.value)} />
            </label>
            <label>
              Venue
              <input value={form.venue} onChange={(e) => set('venue', e.target.value)} />
            </label>
            <label>
              Date &amp; time
              <input type="datetime-local" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} />
            </label>
            <label>
              Date, as printed
              <input value={form.date_label} placeholder="Saturday, the twelfth of December" onChange={(e) => set('date_label', e.target.value)} />
            </label>
            <label>
              Year, as printed
              <input value={form.year_label} placeholder="Two thousand twenty six" onChange={(e) => set('year_label', e.target.value)} />
            </label>
            <label>
              RSVP by, as printed
              <input value={form.reply_by} placeholder="the first of November" onChange={(e) => set('reply_by', e.target.value)} />
            </label>
          </div>

          <label className="content-row__field content-row__field--text">
            Notes (private — never shown to guests)
            <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>

          <div className="grid">
            <label className="checkbox">
              <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
              Published — live on the public site
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.open_rsvp} onChange={(e) => set('open_rsvp', e.target.checked)} />
              Open RSVP — anyone with the shared link can reply for themselves
            </label>
          </div>

          {error && <p className="error">{String(error.message)}</p>}

          <div className="dialog__actions">
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary" type="submit" disabled={saving}>
              <Icon name={saving ? 'spinner' : 'save'} /> {saving ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
