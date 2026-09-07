import { useEffect, useState } from 'react';

/**
 * State that survives a reload, kept in this browser and nowhere else.
 *
 * The planner is deliberately local: a half-finished budget is not something
 * to put on a server the couple's suppliers' invoices will outlive, and it
 * means the page keeps working with no network at a venue. The cost is that
 * it does not follow them to another device — hence the export button on the
 * page itself.
 *
 * `key` includes the wedding slug, so two weddings never share a plan; mount
 * the consumer with a matching React key so a slug change re-reads storage
 * rather than writing one wedding's plan over another's.
 *
 * `initial` may be a value or, as with useState, a factory called only when
 * there is nothing stored — the planner's defaults are built rather than
 * shared, so every task and budget line gets an id of its own.
 */
export function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    const fallback = () => (typeof initial === 'function' ? initial() : initial);
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback();
    } catch {
      // Private windows and blocked site data throw on access rather than
      // returning null; the planner should still work, just without memory.
      return typeof initial === 'function' ? initial() : initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* nothing to do: the page works, this session just won't be remembered */
    }
  }, [key, value]);

  return [value, setValue];
}
