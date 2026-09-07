import crypto from 'node:crypto';
import { db } from './db.js';
import { hashPassword, verifyPassword } from './auth.js';
import { sendMail, codeEmail } from './mailer.js';

export const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** How many codes one account may request per hour, per purpose. */
const MAX_PER_HOUR = 5;

const minutesAgo = (n) => new Date(Date.now() - n * 60_000);

/** A 6-digit code, uniform over 000000–999999 (no modulo bias). */
const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Emails `user` a fresh one-time code. Any earlier unused code for the same
 * purpose is consumed first, so only the newest email ever works.
 */
export async function issueCode(user, purpose) {
  const recent = await db('auth_codes')
    .where({ user_id: user.id, purpose })
    .where('created_at', '>', minutesAgo(60))
    .count({ n: '*' })
    .first();
  if (Number(recent?.n || 0) >= MAX_PER_HOUR) {
    throw Object.assign(new Error('too many codes requested — please try again later'), { status: 429 });
  }

  await db('auth_codes')
    .where({ user_id: user.id, purpose })
    .whereNull('consumed_at')
    .update({ consumed_at: db.fn.now() });

  const code = generateCode();
  await db('auth_codes').insert({
    user_id: user.id,
    purpose,
    code_hash: await hashPassword(code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
  });

  const { subject, text, html } = codeEmail({
    name: user.name,
    code,
    minutes: CODE_TTL_MINUTES,
    purpose,
  });
  await sendMail({ to: user.email, subject, text, html });
}

/**
 * Checks `code` against the newest live code for the user. Returns true and
 * burns the code on success; counts the attempt and returns false otherwise.
 */
export async function consumeCode(user, purpose, code) {
  const row = await db('auth_codes')
    .where({ user_id: user.id, purpose })
    .whereNull('consumed_at')
    .where('expires_at', '>', db.fn.now())
    .orderBy('id', 'desc')
    .first();
  if (!row) return false;

  if (row.attempts >= MAX_ATTEMPTS) {
    await db('auth_codes').where({ id: row.id }).update({ consumed_at: db.fn.now() });
    return false;
  }

  if (!(await verifyPassword(String(code).trim(), row.code_hash))) {
    await db('auth_codes').where({ id: row.id }).increment('attempts', 1);
    return false;
  }

  await db('auth_codes').where({ id: row.id }).update({ consumed_at: db.fn.now() });
  return true;
}
