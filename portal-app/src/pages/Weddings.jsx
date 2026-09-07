import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Page, State } from '../components/Page.jsx';
import { SITE_BASE, demoUrl } from '../lib/site.js';
import Icon from '../components/Icon.jsx';
import { dateLabel, yearLabel, replyByLabel } from '../lib/dateWords.js';

/** Same shape the API derives server-side: lowercase, non-alphanumerics to dashes. */
function slugify(bride, groom) {
  return [bride, groom].filter(Boolean).join('-').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const blank = {
  bride: '', groom: '', slug: '', city: '', event_date: '',
  date_label: '', year_label: '', reply_by: '', venue: '', hashtag: '',
};

/**
 * Entry point for "my wedding". Each account manages at most one, so this
 * page never lists or browses others — it either shows the create form (no
 * wedding yet) or sends the caller straight to /weddings/:slug for the one
 * they already own.
 */
export default function Weddings() {
  const { data, error, loading, reload } = useAsync(() => api.weddings.list(), []);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState(blank);
  // Which of the derived fields (slug, the worded dates) the couple has typed
  // into themselves. Those stay as written; the rest keep following the names
  // and the date picker.
  const [edited, setEdited] = useState({});

  /**
   * The slug is just the two names joined, so it follows them as they are
   * typed until the couple picks their own.
   */
  function setName(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (!edited.slug) next.slug = slugify(next.bride, next.groom);
      return next;
    });
  }

  /**
   * Picking a date fills in the three fields that are just that date spelled
   * out, so the common case needs no typing at all.
   */
  function pickDate(value) {
    const derived = {
      date_label: dateLabel(value),
      year_label: yearLabel(value),
      reply_by: replyByLabel(value),
    };
    setForm((prev) => {
      const next = { ...prev, event_date: value };
      for (const [key, label] of Object.entries(derived)) {
        if (!edited[key]) next[key] = label;
      }
      return next;
    });
  }

  // Typing over a derived label marks it as the couple's own wording; clearing
  // it again hands the field back to the date picker.
  function setLabel(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setEdited((prev) => ({ ...prev, [key]: value !== '' }));
  }

  if (loading) return <p className="empty">Loading…</p>;
  if (error) return <p className="error">{String(error.message)}</p>;
  if (data && data.length > 0) return <Navigate to={`/weddings/${data[0].slug}`} replace />;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // Blank optional fields are dropped so the API keeps its own defaults;
      // an empty slug lets it derive one from the couple's names.
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await api.weddings.create(payload);
      reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title="Set up your wedding">
      <State loading={false} error={null}>
        <p className="muted" style={{ marginTop: -6, marginBottom: 20 }}>
          One wedding per account. Once created, invitations live at{' '}
          <code>{SITE_BASE}/&lt;slug&gt;/&lt;inviteeSlug&gt;</code>.
        </p>

        {/* Filling in this form is a lot easier having seen what it produces,
            so the sample sits above it rather than somewhere further in. */}
        <div className="card demo-callout">
          <div>
            <strong>Not sure what you are building?</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Open a finished sample invitation — the story, gallery, schedule and
              RSVP form are all editable once your wedding exists.
            </p>
          </div>
          <a className="button primary" href={demoUrl()} target="_blank" rel="noreferrer">
            <Icon name="wand-magic-sparkles" /> View sample site
          </a>
        </div>

        <form className="card form" onSubmit={submit}>
          <div className="grid">
            <label>
              bride *
              <input value={form.bride} required placeholder="Tharu" onChange={(e) => setName('bride', e.target.value)} />
            </label>
            <label>
              groom *
              <input value={form.groom} required placeholder="Sithika" onChange={(e) => setName('groom', e.target.value)} />
            </label>
            <label>
              url slug
              <input
                value={form.slug}
                placeholder="tharu-sithika (auto from names)"
                onChange={(e) => setLabel('slug', e.target.value)}
              />
            </label>
            <label>
              city
              <input value={form.city} placeholder="Kandy, Sri Lanka" onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
            <label>
              date &amp; time
              <input type="datetime-local" value={form.event_date} onChange={(e) => pickDate(e.target.value)} />
            </label>
            <label>
              date label
              <input value={form.date_label} placeholder="Monday, 26 October 2026"
                onChange={(e) => setLabel('date_label', e.target.value)} />
            </label>
            <label>
              year label
              <input value={form.year_label} placeholder="2026"
                onChange={(e) => setLabel('year_label', e.target.value)} />
            </label>
            <label>
              RSVP closing date
              <input value={form.reply_by} placeholder="01 September 2026"
                onChange={(e) => setLabel('reply_by', e.target.value)} />
            </label>
            <label>
              venue
              <input value={form.venue} placeholder="St. Anne’s Chapel" onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            </label>
            <label>
              hashtag
              <input value={form.hashtag} placeholder="#AradhanaWedsSithika" onChange={(e) => setForm({ ...form, hashtag: e.target.value })} />
            </label>
          </div>
          {formError && <p className="error">{String(formError.message)}</p>}
          <button className="primary" disabled={saving}>{saving ? 'Creating…' : 'Create wedding'}</button>
        </form>
      </State>
    </Page>
  );
}
