import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';

export const PAGE_SIZES = [25, 50, 100, 250];

/**
 * Client-side paging over a list already in memory.
 *
 * Every table in the portal is scoped to one wedding, so the whole list is a
 * few hundred rows at most and is already fetched in one call — paging here
 * keeps the browser from laying out a thousand rows without adding a
 * round-trip per page, and the counts stay exact because nothing is hidden
 * behind an offset.
 *
 * `signature` is anything that means "this is a different list now" — the
 * active tab, a search string, a filter. When it changes the view returns to
 * page 1, so a filter can never leave the reader stranded on a page that no
 * longer exists.
 */
export function usePagination(items, signature = '') {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const list = items || [];
  const pages = Math.max(1, Math.ceil(list.length / size));

  useEffect(() => { setPage(1); }, [signature, size]);
  // A deletion can empty the last page; step back rather than showing nothing.
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const slice = useMemo(() => list.slice((page - 1) * size, page * size), [list, page, size]);
  return { slice, page, setPage, size, setSize, pages, total: list.length };
}

/** The control bar. Renders nothing at all when there is only one page. */
export default function Pagination({ page, setPage, size, setSize, pages, total, unit = 'rows' }) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);

  return (
    <div className="pager">
      <span className="count">
        {from}–{to} of {total} {unit}
      </span>
      <label className="pager__size">
        Per page
        <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {pages > 1 && (
        <div className="pager__nav">
          <button type="button" onClick={() => setPage(1)} disabled={page === 1} title="First page" aria-label="First page">
            <Icon name="angles-left" />
          </button>
          <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1} title="Previous page" aria-label="Previous page">
            <Icon name="angle-left" />
          </button>
          <span className="pager__where">Page {page} of {pages}</span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page === pages} title="Next page" aria-label="Next page">
            <Icon name="angle-right" />
          </button>
          <button type="button" onClick={() => setPage(pages)} disabled={page === pages} title="Last page" aria-label="Last page">
            <Icon name="angles-right" />
          </button>
        </div>
      )}
    </div>
  );
}
