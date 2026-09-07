# Kwings Wedding Invitation — Backend

Node + Express + Knex API for guest registration, RSVP/participation tracking,
image uploads to MinIO (S3), and per-visit invitation analytics.

## Server resources (already provisioned)

- **Postgres** db `kwings-wedding-invitation`, role `kwings_wedding` (server `164.68.97.187`, listens on `127.0.0.1:5432`).
- **MinIO bucket** `kwings-wedding-invitation` (public read), public base `https://minio.kwingsmedia.com/kwings-wedding-invitation`.

The DB and MinIO listen on the server's localhost, so local development goes
through an SSH tunnel.

## Getting started

```bash
cp .env.example .env      # already filled in with real credentials on this machine
npm install

# Terminal 1 — open the tunnel (local 5433->pg, 9100->minio) and leave it running
npm run tunnel

# Terminal 2
npm run migrate           # apply knex migrations
npm run seed              # import web-ui/src/data/guests/*.json into the guests table
npm run dev               # start the API on http://localhost:4000
```

## Schema (knex migrations in ./migrations)

- **guests** — code, slug, name, household, side, email, phone, photo_url;
  participation: `rsvp_status` (pending/attending/declined/maybe), `max_seats`,
  `attending_count`, `adults_count`, `kids_count`, `dietary`, `message`;
  counters: `open_count`, `click_count`, `first_opened_at`, `last_opened_at`, `responded_at`.
- **images** — S3/MinIO objects (guest_id, category, bucket, object_key, url, alt, mime_type, size_bytes).
- **invitation_events** — one row per open/click/rsvp/view: guest_id, slug,
  event_type, ip, user_agent, referer, url, device, meta, created_at.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/health` | DB connectivity check |
| GET  | `/api/guests` | list guests |
| GET  | `/api/guests/:slug` | one guest |
| POST | `/api/guests` | register a guest |
| PATCH| `/api/guests/:slug` | update fields |
| POST | `/api/guests/:slug/rsvp` | submit RSVP + participation counts |
| GET  | `/api/guests/stats/summary` | totals & counts by status |
| POST | `/api/uploads` | multipart `file` upload → MinIO + images row (`category`, `alt`, `slug`) |
| GET  | `/api/uploads` | list images (`?category=`, `?guest_id=`) |
| POST | `/api/track` | record open/click event (IP + UA captured server-side) |
| GET  | `/api/track` | read events (`?slug=`, `?event_type=`, `?limit=`) |
```
