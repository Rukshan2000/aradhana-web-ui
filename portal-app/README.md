# Kwings Portal App

Vite + React admin front end for `portal-api`.

## Setup

```bash
npm install
npm run dev     # http://localhost:5174
```

The dev server proxies `/api` and `/health` to `http://localhost:4000` (the API's
default `PORT`). Point it elsewhere with `VITE_API_TARGET`:

```bash
VITE_API_TARGET=http://localhost:4001 npm run dev
```

For a production build against a deployed API, set `VITE_API_BASE` to the API
origin (see `.env.example`); leave it empty to keep same-origin `/api` requests.

```bash
npm run build && npm run preview
```

## Pages

| Route | What it does | API used |
| --- | --- | --- |
| `/dashboard` | Totals, RSVP breakdown, recent activity | `GET /api/guests/stats/summary`, `GET /api/track` |
| `/guests` | Searchable/filterable guest list, create guest | `GET/POST /api/guests` |
| `/guests/:slug` | Guest detail, edit RSVP, upload guest photo, per-guest events | `GET /api/guests/:slug`, `POST /api/guests/:slug/rsvp`, `POST /api/uploads`, `GET /api/track?slug=` |
| `/events` | Invitation events filtered by slug / type / limit | `GET /api/track` |
| `/images` | Upload and browse images by category | `GET/POST /api/uploads` |

The API health check drives the status dot in the sidebar.

## Layout

- `src/lib/api.js` — the single place every endpoint is defined.
- `src/lib/useAsync.js` — small loading/error/reload hook.
- `src/components/Page.jsx` — shared page header, loading/error states, badges.
- `src/pages/` — one file per route.
