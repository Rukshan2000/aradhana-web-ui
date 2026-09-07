import { db } from './db.js';

/**
 * The guest code is the internal identifier for an invitee. It is assigned
 * here and never accepted from or shown to a client — callers address guests
 * by their slug, so a code sent in a request body is ignored.
 *
 * It is derived from the row's own primary key, which Postgres never reuses,
 * so a retired code is never handed to a later guest. (Numbering from the
 * highest code in use would reuse it as soon as the last guest was deleted.)
 */
export const codeFor = (id) => `G${String(id).padStart(4, '0')}`;

/**
 * Inserts a guest and stamps its code in the same transaction, so a row can
 * never be left with the placeholder if the second statement fails.
 */
export async function insertGuest(fields) {
  return db.transaction(async (trx) => {
    const [row] = await trx('guests')
      .insert({ ...fields, code: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
      .returning('*');
    const [guest] = await trx('guests')
      .where({ id: row.id })
      .update({ code: codeFor(row.id) })
      .returning('*');
    return guest;
  });
}

/** Strips server-only fields before a guest goes out over the wire. */
export function publicGuest(guest) {
  if (!guest) return guest;
  const { code, ...rest } = guest;
  return rest;
}
