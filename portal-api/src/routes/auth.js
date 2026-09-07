import { asyncRouter } from '../asyncRouter.js';
import { db } from '../db.js';
import { hashPassword, verifyPassword, issueSession, clearSession, requireAuth, publicUser } from '../auth.js';
import { issueCode, consumeCode, CODE_TTL_MINUTES } from '../otp.js';
import { mailEnabled } from '../mailer.js';

const router = asyncRouter();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

const findByEmail = (email) => db('users').where({ email: String(email || '').toLowerCase() }).first();

/**
 * Both "send me a code" endpoints answer the same way whether or not the
 * address has an account, so neither can be used to enumerate our users.
 */
const CODE_SENT = { ok: true, expires_in_minutes: CODE_TTL_MINUTES };

function requireMail(res) {
  if (mailEnabled) return true;
  res.status(503).json({ error: 'email is not configured on this server' });
  return false;
}

/**
 * Register a portal account. Open sign-up: anyone who reaches /register can
 * create an account and gets full access to every wedding/guest immediately.
 */
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'a valid email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  if (!name) return res.status(400).json({ error: 'name is required' });

  const existing = await db('users').where({ email: email.toLowerCase() }).first();
  if (existing) return res.status(409).json({ error: 'an account with that email already exists' });

  const [user] = await db('users')
    .insert({ email: email.toLowerCase(), password_hash: await hashPassword(password), name })
    .returning('*');

  issueSession(res, user);
  res.status(201).json(publicUser(user));
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = await db('users').where({ email: String(email).toLowerCase() }).first();
  const ok = user && (await verifyPassword(password, user.password_hash));
  if (!ok) return res.status(401).json({ error: 'invalid email or password' });

  issueSession(res, user);
  res.json(publicUser(user));
});

/**
 * Passwordless sign-in, step 1: email a one-time code.
 *
 * Rate limiting and "only the newest code works" live in issueCode. A send
 * failure (bad mailbox, SMTP down) is swallowed deliberately — surfacing it
 * would tell the caller the account exists.
 */
router.post('/login/code', async (req, res) => {
  if (!requireMail(res)) return;
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'a valid email is required' });

  const user = await findByEmail(email);
  if (user) {
    try {
      await issueCode(user, 'login');
    } catch (err) {
      if (err.status === 429) return res.status(429).json({ error: err.message });
      console.error('failed to send login code', err);
    }
  }
  res.json(CODE_SENT);
});

/** Passwordless sign-in, step 2: exchange the code for a session. */
router.post('/login/code/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'a valid email is required' });
  if (!code || !CODE_RE.test(String(code).trim())) return res.status(400).json({ error: 'enter the 6-digit code from your email' });

  const user = await findByEmail(email);
  const ok = user && (await consumeCode(user, 'login', code));
  if (!ok) return res.status(401).json({ error: 'that code is invalid or has expired' });

  issueSession(res, user);
  res.json(publicUser(user));
});

/** Password reset, step 1: email a one-time code. Same silence as above. */
router.post('/password/forgot', async (req, res) => {
  if (!requireMail(res)) return;
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'a valid email is required' });

  const user = await findByEmail(email);
  if (user) {
    try {
      await issueCode(user, 'password_reset');
    } catch (err) {
      if (err.status === 429) return res.status(429).json({ error: err.message });
      console.error('failed to send reset code', err);
    }
  }
  res.json(CODE_SENT);
});

/**
 * Password reset, step 2: the code proves the mailbox, so it buys both a new
 * password and a session — no second sign-in right after resetting.
 */
router.post('/password/reset', async (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'a valid email is required' });
  if (!code || !CODE_RE.test(String(code).trim())) return res.status(400).json({ error: 'enter the 6-digit code from your email' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const user = await findByEmail(email);
  const ok = user && (await consumeCode(user, 'password_reset', code));
  if (!ok) return res.status(401).json({ error: 'that code is invalid or has expired' });

  const [updated] = await db('users')
    .where({ id: user.id })
    .update({ password_hash: await hashPassword(password), updated_at: db.fn.now() })
    .returning('*');

  issueSession(res, updated);
  res.json(publicUser(updated));
});

/**
 * Password change while already signed in — proves identity with the
 * current password rather than an emailed code, so it works even when mail
 * isn't configured on this server.
 */
router.post('/password/change', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ error: 'current password is required' });
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'new password must be at least 8 characters' });

  const ok = await verifyPassword(currentPassword, req.user.password_hash);
  if (!ok) return res.status(401).json({ error: 'current password is incorrect' });

  const [updated] = await db('users')
    .where({ id: req.user.id })
    .update({ password_hash: await hashPassword(newPassword), updated_at: db.fn.now() })
    .returning('*');

  issueSession(res, updated);
  res.json(publicUser(updated));
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

/** Profile edits beyond the password: currently just the display name. */
router.patch('/me', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });

  const [updated] = await db('users')
    .where({ id: req.user.id })
    .update({ name: String(name).trim(), updated_at: db.fn.now() })
    .returning('*');
  res.json(publicUser(updated));
});

export default router;
