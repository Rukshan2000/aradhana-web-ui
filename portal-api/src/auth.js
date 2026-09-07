import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET must be set (see .env) — refusing to start with an unsigned auth system.');
}

const COOKIE = 'portal_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const hashPassword = (password) => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE);
}

/** Attaches req.user when a valid session cookie is present; never rejects. */
export async function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const { sub } = jwt.verify(token, SECRET);
    req.user = await db('users').where({ id: sub }).first();
  } catch {
    // expired or tampered token — treat as logged out rather than erroring
  }
  next();
}

/** Blocks the request unless attachUser found a valid session. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'authentication required' });
  next();
}

export const publicUser = ({ id, email, name, created_at }) => ({ id, email, name, created_at });
