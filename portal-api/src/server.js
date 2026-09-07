import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth.js';
import weddingsRouter from './routes/weddings.js';
import guestsRouter from './routes/guests.js';
import uploadsRouter from './routes/uploads.js';
import trackingRouter from './routes/tracking.js';
import { db } from './db.js';
import { attachUser } from './auth.js';

const app = express();
app.set('trust proxy', true); // so req.ip reflects the real client behind a proxy

// The session lives in a cookie, so the browser must be told to send it and
// the response must be allowed to set it. In dev the portal reaches the API
// through Vite's proxy (same browser origin), so this mainly matters once
// portal-app and portal-api are deployed on different origins.
app.use(cors({ origin: process.env.PORTAL_ORIGIN || true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get('/health', async (_req, res) => {
  try {
    await db.raw('select 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/weddings', weddingsRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/track', trackingRouter);

// Every route touches the DB, which sits behind the SSH tunnel. Without this
// a tunnel drop surfaces as an unhandled rejection and kills the process; with
// it the request fails cleanly and the server stays up.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: String(err.message || err) });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
