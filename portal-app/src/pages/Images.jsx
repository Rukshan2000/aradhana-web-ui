import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Page, State, fmtDate } from '../components/Page.jsx';
import Icon from '../components/Icon.jsx';
import Pagination, { usePagination } from '../components/Pagination.jsx';
import { useDialogs } from '../components/Dialog.jsx';

const CATEGORIES = ['hero', 'story', 'gallery', 'venue', 'guest'];

export default function Images() {
  const [category, setCategory] = useState('');
  const { data: rawData, error, loading, reload } = useAsync(
    () => api.images.list({ category: category || undefined }),
    [category],
  );
  // This page renders every item as a photo tile; the background-music
  // track (managed from My Wedding instead) doesn't belong here.
  const data = rawData?.filter((img) => img.category !== 'music');
  const [files, setFiles] = useState([]);
  const [uploadCategory, setUploadCategory] = useState('gallery');
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [uploadResults, setUploadResults] = useState([]);
  const fileInputRef = useRef(null);
  const [deletingId, setDeletingId] = useState(null);
  const { confirm } = useDialogs();

  async function remove(img) {
    const yes = await confirm({
      title: `Delete "${img.alt || img.object_key.split('/').pop()}"?`,
      body: 'The photo is removed from storage and disappears everywhere it is used on the invitation.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!yes) return;
    setDeletingId(img.id);
    setErr(null);
    try {
      await api.images.remove(img.id);
      reload();
    } catch (e2) {
      setErr(e2);
    } finally {
      setDeletingId(null);
    }
  }

  async function upload(e) {
    e.preventDefault();
    if (files.length === 0) return;
    setBusy(true); setErr(null);
    setUploadResults(files.map((file) => ({ name: file.name, state: 'waiting' })));
    let uploaded = 0;
    for (const [index, file] of files.entries()) {
      setUploadResults((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, state: 'uploading' } : item));
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', uploadCategory);
        if (alt) fd.append('alt', files.length === 1 ? alt : file.name.replace(/\.[^/.]+$/, ''));
        await api.images.upload(fd);
        uploaded += 1;
        setUploadResults((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, state: 'done' } : item));
      } catch (e2) {
        setUploadResults((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, state: 'failed', error: e2.message } : item));
      }
    }
    if (uploaded > 0) reload();
    if (uploaded < files.length) setErr(new Error(`${files.length - uploaded} upload${files.length - uploaded === 1 ? '' : 's'} failed`));
    if (uploaded === files.length) {
      setFiles([]); setAlt('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setBusy(false);
  }

  // Photos are heavy to lay out and lazy-loading only defers the bytes, not
  // the thousand DOM nodes; the gallery pages like the tables do.
  const pager = usePagination(data, category);

  return (
    <Page title="Images" actions={<button onClick={reload} title="Refresh"><Icon name="rotate-right" /> Refresh</button>}>
      <form className="card form" onSubmit={upload}>
        <div className="upload-heading">
          <div>
            <h2>Bulk image upload</h2>
            <p className="muted">Select several photos at once. Each image can be up to 20 MB.</p>
          </div>
          <Icon name="images" />
        </div>
        <div className="grid">
          <label>Select images<input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /><small className="muted">Use Cmd/Ctrl or Shift to choose more than one.</small></label>
          <label>
            category
            <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>alt text<input value={alt} onChange={(e) => setAlt(e.target.value)} /></label>
        </div>
        {err && <p className="error">{String(err.message)}</p>}
        {files.length > 0 && <p className="muted upload-count">{files.length} image{files.length === 1 ? '' : 's'} selected · max 20 MB each</p>}
        {uploadResults.length > 0 && (
          <div className="upload-results" aria-live="polite">
            {uploadResults.map((item) => (
              <div className={`upload-result upload-result--${item.state}`} key={item.name}>
                <span>{item.name}</span>
                <strong>{item.state === 'waiting' ? 'Waiting' : item.state === 'uploading' ? 'Uploading…' : item.state === 'done' ? 'Uploaded' : item.error || 'Failed'}</strong>
              </div>
            ))}
          </div>
        )}
        <button className="primary" disabled={busy || files.length === 0}><Icon name="upload" /> {busy ? `Uploading ${files.length} images…` : `Upload ${files.length || ''} image${files.length === 1 ? '' : 's'}`}</button>
      </form>

      <div className="filters">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <State loading={loading} error={error} empty={data?.length === 0}>
        <Pagination {...pager} unit="images" />
        <div className="gallery">
          {pager.slice.map((img) => (
            <figure key={img.id} className="gallery-item">
              <a href={img.url} target="_blank" rel="noreferrer">
                <img src={img.url} alt={img.alt || img.object_key} loading="lazy" />
              </a>
              <button
                type="button"
                className="gallery-item__delete"
                onClick={() => remove(img)}
                disabled={deletingId === img.id}
                aria-label={`Delete ${img.alt || img.object_key}`}
                title="Delete photo"
              >
                {deletingId === img.id ? '…' : <Icon name="trash-can" />}
              </button>
              <figcaption>
                <strong>{img.alt || img.object_key.split('/').pop()}</strong>
                <span className="muted">{img.category} · {fmtDate(img.created_at)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <Pagination {...pager} unit="images" />
      </State>
    </Page>
  );
}
