import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import Icon from './Icon.jsx';
import { useDialogs } from './Dialog.jsx';

/**
 * The content editor puts a MediaPicker on every photo field — a dozen or
 * more on one page (hero, venue, each story chapter, each gallery tile…).
 * Without this, each one would fetch the same image list independently;
 * MediaLibraryProvider fetches it once and every picker below shares it.
 */
const MediaLibraryContext = createContext(null);

export function MediaLibraryProvider({ children }) {
  const { data, loading, reload } = useAsync(() => api.images.list(), []);
  // The picker and rail render everything as an <img> — audio tracks (an
  // upload category of their own) don't belong in this library.
  const images = (data || []).filter((img) => img.category !== 'music');
  return (
    <MediaLibraryContext.Provider value={{ images, loading, reload }}>
      {children}
    </MediaLibraryContext.Provider>
  );
}

/** Every MediaPicker (and MediaRail) must render under a MediaLibraryProvider. */
export function useMediaLibrary() {
  const shared = useContext(MediaLibraryContext);
  if (!shared) throw new Error('MediaPicker must be used within a MediaLibraryProvider');
  return shared;
}

function name(img) {
  return img.alt || img.object_key.split('/').pop();
}

// The MIME type used to hand off a dragged library photo to a drop target —
// namespaced so a drag from elsewhere on the page (or another app) is never
// mistaken for one of our own image tiles.
const DRAG_TYPE = 'application/x-kwings-image-url';

/**
 * A sticky left-hand rail listing every uploaded photo as a small draggable
 * thumbnail. Drop one onto any MediaPicker field to assign it — the visual,
 * always-visible counterpart to opening each picker's own library one field
 * at a time.
 */
export function MediaRail() {
  const { images, loading, reload } = useMediaLibrary();
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? images.filter((img) => name(img).toLowerCase().includes(q)) : images;
  }, [images, query]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  return (
    <aside className="media-rail">
      <div className="media-rail__head">
        <strong>Photo library</strong>
        <button type="button" className="media-rail__refresh" onClick={reload} title="Refresh"><Icon name="rotate-right" /></button>
      </div>
      <input
        className="media-rail__search"
        type="search"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="muted media-rail__hint">Drag a photo onto any field to use it.</p>
      <div className="media-rail__grid">
        {loading && <p className="muted">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="muted">{query ? 'No matches.' : 'Nothing uploaded yet.'}</p>
        )}
        {filtered.map((img) => (
          <div key={img.id} className="media-rail__item">
            <img
              src={img.url}
              alt=""
              title={name(img)}
              className="media-rail__thumb"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ url: img.url, alt: img.alt || '' }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
            />
            <button
              type="button"
              className="media-rail__preview-btn"
              onClick={() => setPreview(img)}
              aria-label={`Preview ${name(img)}`}
              title="Preview"
            >
              <Icon name="expand" />
            </button>
          </div>
        ))}
      </div>

      {preview && createPortal(
        // Portalled to <body> — the rail is `position: sticky`, which forms its
        // own stacking context, so a z-index here would only ever win locally
        // and could still end up buried under other panels (e.g. an open
        // MediaPicker's own dropdown) elsewhere in the tree.
        <div className="media-lightbox" onClick={() => setPreview(null)}>
          <div className="media-lightbox__panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="media-lightbox__close"
              onClick={() => setPreview(null)}
              aria-label="Close preview"
            >
              <Icon name="xmark" />
            </button>
            <img src={preview.url} alt={preview.alt || ''} />
            <div className="media-lightbox__meta">
              <strong>{name(preview)}</strong>
              <span className="muted">{preview.category}</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </aside>
  );
}

/**
 * Picks an image for one content field — hero photo, a story chapter's
 * photo, a gallery tile — from everything already uploaded for this
 * wedding. Every place in the content editor that used to be a raw
 * "paste an image URL" text box uses this instead.
 *
 * `value` is the image's public URL (the same thing the field used to hold
 * as plain text), so this drops in wherever that was. `onChange(url, meta)`
 * passes back the picked image's stored title too, so the caller can offer
 * to fill in a matching description field.
 *
 * Uploading new photos happens on the Images page, not here — this picker
 * only chooses from what's already in the library, so a content field can
 * never end up pointing at a fresh, unreviewed upload.
 */
export default function MediaPicker({ value, onChange, category = 'gallery' }) {
  // Every uploaded photo is offered, not just this field's own category —
  // a photo uploaded for the gallery is just as usable as a hero image.
  const { images, loading, reload } = useMediaLibrary();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [dropTarget, setDropTarget] = useState(false);
  const rootRef = useRef(null);

  const selected = images.find((img) => img.url === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? images.filter((img) => name(img).toLowerCase().includes(q)) : images;
    // This field's own category floats to the top — everything else stays
    // browsable underneath instead of being hidden.
    return list.slice().sort((a, b) => {
      const am = a.category === category ? 0 : 1;
      const bm = b.category === category ? 0 : 1;
      return am - bm;
    });
  }, [images, query, category]);

  const [deletingId, setDeletingId] = useState(null);
  const { confirm } = useDialogs();

  function pick(img) {
    onChange(img.url, { alt: img.alt || '' });
    setOpen(false);
    setQuery('');
  }

  async function remove(img, e) {
    e.stopPropagation();
    const yes = await confirm({
      title: `Delete "${name(img)}"?`,
      body: 'The photo is removed from storage and disappears everywhere it is used on the invitation.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!yes) return;
    setDeletingId(img.id);
    setError(null);
    try {
      await api.images.remove(img.id);
      if (img.url === value) onChange('', {});
      await reload();
    } catch (err) {
      setError(err);
    } finally {
      setDeletingId(null);
    }
  }

  function closeOnBlur(e) {
    if (rootRef.current && !rootRef.current.contains(e.relatedTarget)) setOpen(false);
  }

  function dragHasImage(e) {
    return e.dataTransfer.types.includes(DRAG_TYPE);
  }

  function handleDrop(e) {
    if (!dragHasImage(e)) return;
    e.preventDefault();
    setDropTarget(false);
    try {
      const { url, alt } = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
      onChange(url, { alt });
    } catch {
      // Malformed payload — ignore rather than corrupt the field.
    }
  }

  return (
    <div className="media-picker" ref={rootRef} onBlur={closeOnBlur}>
      <div
        className={`media-picker__trigger${dropTarget ? ' media-picker__trigger--drop' : ''}`}
        onDragOver={(e) => { if (dragHasImage(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onDragEnter={(e) => { if (dragHasImage(e)) setDropTarget(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(false); }}
        onDrop={handleDrop}
      >
        <button
          type="button"
          className="media-picker__trigger-open"
          onClick={() => setOpen((v) => !v)}
        >
          {selected?.url ? (
            <img className="media-picker__thumb" src={selected.url} alt="" />
          ) : (
            <span className="media-picker__thumb media-picker__thumb--empty" aria-hidden="true">
              <Icon name="image" />
            </span>
          )}
          <span className="media-picker__trigger-text">
            <strong>{selected ? name(selected) : loading ? 'Loading…' : 'Choose a photo'}</strong>
            <span className="muted">{selected ? 'Click to change' : 'Choose from library'}</span>
          </span>
        </button>
        {value && (
          <button
            type="button"
            className="media-picker__trigger-clear"
            onClick={() => onChange('', {})}
            aria-label="Remove photo from this field"
            title="Remove photo"
          >
            <Icon name="xmark" />
          </button>
        )}
      </div>

      {open && (
        <div className="media-picker__panel">
          {images.length > 0 && (
            <input
              className="media-picker__search"
              type="search"
              placeholder="Search uploaded photos…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}

          {error && <p className="error">{String(error.message)}</p>}

          <div className="media-picker__grid">
            {filtered.map((img) => (
              <div
                key={img.id}
                role="button"
                tabIndex={0}
                className={`media-picker__tile${img.url === value ? ' media-picker__tile--selected' : ''}${deletingId === img.id ? ' media-picker__tile--busy' : ''}`}
                onClick={() => pick(img)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(img); } }}
                title={name(img)}
              >
                <img src={img.url} alt="" />
                {img.url === value && <span className="media-picker__tile-check"><Icon name="check" /></span>}
                <button
                  type="button"
                  className="media-picker__tile-delete"
                  onClick={(e) => remove(img, e)}
                  disabled={deletingId === img.id}
                  aria-label={`Delete ${name(img)}`}
                  title="Delete photo"
                >
                  {deletingId === img.id ? '…' : <Icon name="trash-can" />}
                </button>
                <span className="media-picker__tile-label">{name(img)}</span>
              </div>
            ))}
            {!loading && filtered.length === 0 && (
              <p className="muted media-picker__empty">
                {query ? 'No photos match that search.' : 'Nothing uploaded yet — add photos from the Images page.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
