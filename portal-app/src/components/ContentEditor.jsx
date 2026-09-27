import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import MediaPicker, { MediaLibraryProvider, MediaRail } from './MediaPicker.jsx';
import MusicPicker from './MusicPicker.jsx';
import Icon from './Icon.jsx';

/** Every key the editor manages, with the empty value a fresh wedding starts
    from. Keeps the form's shape stable even before anything has been typed. */
const EMPTY_CONTENT = {
  hero: { src: '', mobileSrc: '', alt: '' },
  // Every heading the invitation prints, so none of them is stranded in the
  // markup where only a developer can change it.
  headings: {
    hero: { eyebrow: '' },
    invitation: { eyebrow: '', title: '' },
    countdown: { eyebrow: '' },
    story: { eyebrow: '', title: '' },
    gallery: { eyebrow: '', title: '' },
    details: { eyebrow: '', title: '' },
    schedule: { title: '' },
    rsvp: { eyebrow: '', title: '' },
  },
  story: [],
  gallery: [],
  galleryPool: [],
  details: [],
  schedule: [],
  venuePhoto: { src: '', mobileSrc: '', alt: '' },
  music: { track: '', startAt: 0, endAt: 0, volume: 0.5 },
};

const STORY_ROW = { year: '', title: '', text: '', photo: '', mobilePhoto: '', alt: '' };
const GALLERY_ROW = { src: '', mobileSrc: '', alt: '', span: '' };
const POOL_ROW = { src: '', mobileSrc: '', alt: '' };
const DETAILS_ROW = { label: '', time: '', venue: '', address: '', mapUrl: '', note: '' };
const SCHEDULE_ROW = { time: '', event: '' };

/** Every photo slot has an optional second photo for phones (768px wide or
    less), for pictures whose crop only works on one screen shape. */
const MOBILE_LABEL = 'Mobile photo (optional — used on phones instead)';

/** One field of one row in a repeatable list. */
function RowField({ label, value, onChange, type = 'text', textarea, options, media, onMediaPick, placeholder }) {
  if (media) {
    return (
      <label className="content-row__field content-row__field--media">
        {label}
        <MediaPicker value={value} category={media} onChange={onMediaPick} />
      </label>
    );
  }
  return (
    // Prose gets the full width of the row: a story chapter or a schedule
    // note is a paragraph, and reading it two lines at a time through a
    // scrollbar is worse than the extra height costs.
    <label className={`content-row__field${textarea ? ' content-row__field--text' : ''}`}>
      {label}
      {textarea ? (
        <textarea rows={5} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

/**
 * A variable-length list of similarly-shaped rows — the story's chapters,
 * the gallery's photos, the day's schedule — each with add/remove/reorder.
 */
function RepeatableList({ title, hint, items, blankRow, fields, onChange }) {
  const update = (i, key, value) => {
    const next = items.slice();
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...items, { ...blankRow }]);

  return (
    <fieldset className="content-list">
      <legend>{title}</legend>
      {hint && <p className="muted content-list__hint">{hint}</p>}
      {items.length === 0 && <p className="muted">Nothing added yet.</p>}
      {items.map((row, i) => (
        <div className="content-row" key={i}>
          <div className="content-row__grid">
            {fields.map((f) => (
              <RowField
                key={f.key}
                label={f.label}
                type={f.type}
                textarea={f.textarea}
                options={f.options}
                media={f.media}
                value={row[f.key] ?? ''}
                onChange={(v) => update(i, f.key, v)}
                onMediaPick={(url, meta) => {
                  const next = items.slice();
                  next[i] = { ...next[i], [f.key]: url };
                  // Only offer the uploaded title where a description hasn't
                  // already been typed, so picking a photo never overwrites it.
                  if (f.altKey && meta.alt && !next[i][f.altKey]) next[i][f.altKey] = meta.alt;
                  onChange(next);
                }}
              />
            ))}
          </div>
          <div className="content-row__actions">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><Icon name="arrow-up" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Move down"><Icon name="arrow-down" /></button>
            <button type="button" className="danger" onClick={() => remove(i)} title="Remove"><Icon name="trash-can" /> Remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}>+ Add</button>
    </fieldset>
  );
}

/**
 * Everything about the invitation page beyond the couple/date/venue fields —
 * hero photo, love story, gallery, day-of schedule, venue photo, music —
 * lives in one document (`weddings.content`) and is built
 * here as plain forms: text fields for the single-object sections (hero,
 * venue photo, music) and add/remove/reorder rows for the
 * variable-length ones (story chapters, gallery photos, schedule stops).
 */
const TABS = [
  { key: 'hero', label: 'Hero photo' },
  { key: 'story', label: 'Our story' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'details', label: 'Day details' },
  { key: 'extras', label: 'Venue & music' },
  { key: 'wording', label: 'Section headings' },
];

/* Every section heading the site prints, in the order a guest scrolls past
   them. `hint` explains what happens when a field is left blank. */
const HEADING_SECTIONS = [
  { key: 'hero', label: 'Hero (over the couple\'s names)', eyebrow: 'Together with their families' },
  { key: 'invitation', label: 'The invitation', eyebrow: 'The invitation', title: 'You are invited to celebrate' },
  { key: 'countdown', label: 'Countdown', eyebrow: 'Counting the days' },
  { key: 'story', label: 'Our story', eyebrow: 'Our story', title: 'counted from your chapters',
    hint: 'Leave the title blank and the site counts it from your chapters — "Seven years, told briefly".' },
  { key: 'gallery', label: 'Gallery', eyebrow: 'Moments', title: 'A few of our favourites' },
  { key: 'details', label: 'Day details', eyebrow: 'The day', title: 'When and where' },
  { key: 'schedule', label: 'Schedule', title: 'Order of the evening',
    hint: 'The schedule and its heading are hidden entirely while there are no stops.' },
  { key: 'rsvp', label: 'RSVP', eyebrow: 'Répondez s\'il vous plaît', title: 'Will you join us?' },
];

export default function ContentEditor({ weddingSlug, content }) {
  const [form, setForm] = useState(EMPTY_CONTENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState(TABS[0].key);

  useEffect(() => {
    setForm({
      hero: { ...EMPTY_CONTENT.hero, ...content?.hero },
      headings: Object.fromEntries(
        Object.entries(EMPTY_CONTENT.headings).map(([k, v]) => [k, { ...v, ...(content?.headings?.[k] || {}) }]),
      ),
      story: content?.story?.length ? content.story : [],
      gallery: content?.gallery?.length ? content.gallery : [],
      galleryPool: content?.galleryPool?.length ? content.galleryPool : [],
      details: content?.details?.length ? content.details : [],
      schedule: content?.schedule?.length ? content.schedule : [],
      venuePhoto: { ...EMPTY_CONTENT.venuePhoto, ...content?.venuePhoto },
      music: { ...EMPTY_CONTENT.music, ...content?.music },
    });
  }, [content]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setField = (key, field, value) => setForm((f) => ({ ...f, [key]: { ...f[key], [field]: value } }));
  const setHeading = (section, field, value) => setForm((f) => ({
    ...f,
    headings: { ...f.headings, [section]: { ...f.headings[section], [field]: value } },
  }));

  async function save(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      // Drop rows left completely blank rather than saving empty entries.
      const payload = {
        ...form,
        story: form.story.filter((r) => Object.values(r).some((v) => v)),
        gallery: form.gallery.filter((r) => Object.values(r).some((v) => v)),
        galleryPool: form.galleryPool.filter((r) => Object.values(r).some((v) => v)),
        details: form.details.filter((r) => Object.values(r).some((v) => v)),
        schedule: form.schedule.filter((r) => Object.values(r).some((v) => v)),
      };
      await api.weddings.update(weddingSlug, { content: payload });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <MediaLibraryProvider>
    <div className="content-editor-layout">
    <MediaRail />
    <form className="card content-editor" onSubmit={save}>
      <div className="content-editor__head">
        <h2 style={{ margin: 0 }}>Site content</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Everything on the invitation page besides the couple's names and date. Anything left blank
          falls back to the site's defaults.
        </p>
      </div>

      <div className="content-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="content-tab-panel" hidden={tab !== 'hero'}>
        <fieldset className="content-list">
          <legend>Hero photo</legend>
          <div className="content-row__grid">
            <RowField
              label="Photo" media="hero" value={form.hero.src}
              onMediaPick={(url, meta) => {
                setField('hero', 'src', url);
                if (meta.alt && !form.hero.alt) setField('hero', 'alt', meta.alt);
              }}
            />
            <RowField
              label={MOBILE_LABEL} media="hero" value={form.hero.mobileSrc}
              onMediaPick={(url) => setField('hero', 'mobileSrc', url)}
            />
            <RowField label="Description (for accessibility)" value={form.hero.alt} onChange={(v) => setField('hero', 'alt', v)} />
          </div>
        </fieldset>
      </div>

      <div className="content-tab-panel" hidden={tab !== 'story'}>
        <RepeatableList
          title="Our story"
          hint="A chapter per milestone — how you met, a proposal, anything you'd like to share."
          items={form.story}
          blankRow={STORY_ROW}
          onChange={(v) => set('story', v)}
          fields={[
            { key: 'year', label: 'Year' },
            { key: 'title', label: 'Title' },
            { key: 'text', label: 'Text', textarea: true },
            { key: 'photo', label: 'Photo', media: 'story', altKey: 'alt' },
            { key: 'mobilePhoto', label: MOBILE_LABEL, media: 'story' },
            { key: 'alt', label: 'Photo description' },
          ]}
        />
      </div>

      <div className="content-tab-panel" hidden={tab !== 'gallery'}>
        <RepeatableList
          title="Gallery"
          hint="The photos shown on the page."
          items={form.gallery}
          blankRow={GALLERY_ROW}
          onChange={(v) => set('gallery', v)}
          fields={[
            { key: 'src', label: 'Photo', media: 'gallery', altKey: 'alt' },
            { key: 'mobileSrc', label: MOBILE_LABEL, media: 'gallery' },
            { key: 'alt', label: 'Description' },
            {
              key: 'span', label: 'Size',
              options: [
                { value: '', label: 'Normal' },
                { value: 'tall', label: 'Tall' },
                { value: 'wide', label: 'Wide' },
              ],
            },
          ]}
        />

        <RepeatableList
          title="Extra gallery photos"
          hint="Additional photos the page can draw from beyond the main gallery."
          items={form.galleryPool}
          blankRow={POOL_ROW}
          onChange={(v) => set('galleryPool', v)}
          fields={[
            { key: 'src', label: 'Photo', media: 'gallery', altKey: 'alt' },
            { key: 'mobileSrc', label: MOBILE_LABEL, media: 'gallery' },
            { key: 'alt', label: 'Description' },
          ]}
        />
      </div>

      <div className="content-tab-panel" hidden={tab !== 'details'}>
        <RepeatableList
          title="Day details"
          hint="Ceremony, reception — one card per event. Paste a Google Maps share link to make the venue tap-to-navigate; left blank, guests get a map search built from the venue name and address."
          items={form.details}
          blankRow={DETAILS_ROW}
          onChange={(v) => set('details', v)}
          fields={[
            { key: 'label', label: 'Label (e.g. The Ceremony)' },
            { key: 'time', label: 'Time (e.g. 4:30 in the afternoon)' },
            { key: 'venue', label: 'Venue name' },
            { key: 'address', label: 'Address' },
            { key: 'mapUrl', label: 'Google Maps link (optional)' },
            { key: 'note', label: 'Note', textarea: true },
          ]}
        />

        <RepeatableList
          title="Schedule"
          hint="The run of the day, shown as a timeline."
          items={form.schedule}
          blankRow={SCHEDULE_ROW}
          onChange={(v) => set('schedule', v)}
          fields={[
            { key: 'time', label: 'Time (e.g. 4:30 pm)' },
            { key: 'event', label: 'Event' },
          ]}
        />
      </div>

      <div className="content-tab-panel" hidden={tab !== 'extras'}>
        <fieldset className="content-list">
          <legend>Venue photo</legend>
          <div className="content-row__grid">
            <RowField
              label="Photo" media="venue" value={form.venuePhoto.src}
              onMediaPick={(url, meta) => {
                setField('venuePhoto', 'src', url);
                if (meta.alt && !form.venuePhoto.alt) setField('venuePhoto', 'alt', meta.alt);
              }}
            />
            <RowField
              label={MOBILE_LABEL} media="venue" value={form.venuePhoto.mobileSrc}
              onMediaPick={(url) => setField('venuePhoto', 'mobileSrc', url)}
            />
            <RowField label="Description" value={form.venuePhoto.alt} onChange={(v) => setField('venuePhoto', 'alt', v)} />
          </div>
        </fieldset>

        <fieldset className="content-list">
          <legend>Background music</legend>
          <MusicPicker value={form.music} onChange={(next) => set('music', next)} />
        </fieldset>
      </div>

      <div className="content-tab-panel" hidden={tab !== 'wording'}>
        <p className="content-list__hint">
          The words above each section. Leave one blank to keep the wording the site ships with.
        </p>
        {HEADING_SECTIONS.map((section) => (
          <fieldset className="content-list" key={section.key}>
            <legend>{section.label}</legend>
            <div className="content-row__grid">
              {section.eyebrow && (
                <RowField
                  label="Small line above"
                  placeholder={section.eyebrow}
                  value={form.headings[section.key].eyebrow ?? ''}
                  onChange={(v) => setHeading(section.key, 'eyebrow', v)}
                />
              )}
              {section.title && (
                <RowField
                  label="Heading"
                  placeholder={section.title}
                  value={form.headings[section.key].title ?? ''}
                  onChange={(v) => setHeading(section.key, 'title', v)}
                />
              )}
            </div>
            {section.hint && <p className="content-list__hint">{section.hint}</p>}
          </fieldset>
        ))}
      </div>

      {error && <p className="error">{String(error.message)}</p>}
      <div className="content-editor__actions">
        <button className="primary" disabled={saving}><Icon name="save" /> {saving ? 'Saving…' : 'Save content'}</button>
        {saved && <span className="content-editor__saved">Saved</span>}
      </div>
    </form>
    </div>
    </MediaLibraryProvider>
  );
}
