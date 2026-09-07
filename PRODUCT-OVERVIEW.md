# Kwings Guest Book — Digital Wedding Invitation & Guest Platform

A full-stack platform for running a wedding's whole guest side from one place:
the couple builds their invitation page in an admin portal, sends every household its own
private link, and watches — invitation by invitation — who opened it, how far they read,
and who is actually coming.

Built as a real multi-tenant product rather than one couple's page: each wedding is its own
tenant with its own owner, content, guests and links, served from a shared public site on a
deployed three-service stack.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, PostgreSQL, Knex (13 migrations + seed script) |
| Auth | JWT in an httpOnly cookie, bcrypt, one-time email codes (Nodemailer) |
| Admin portal | React 18 + Vite, React Router, served as static files by nginx |
| Public site | Astro 5 with SSR (Node adapter) — one dynamic route per wedding |
| Motion | anime.js, Lenis smooth scroll, Vanta/three.js backdrop |
| Media | MinIO (S3-compatible) via `@aws-sdk/client-s3`, public-read bucket |
| Deployment | Docker Compose + host nginx reverse proxy, three subdomains over TLS |

---

## What It Does

### Three surfaces, one API

- **Public invitation site** (`guestbook.kwingsmedia.com`) — the page a guest opens. Server-rendered
  per request so a link can be revoked, an RSVP can be reflected instantly, and content edits go
  live without a rebuild.
- **Admin portal** (`guestbookportal.kwingsmedia.com`) — where the couple builds the wedding, edits
  every word and photo on the page, manages the guest list, generates links and QR codes, and reads
  the analytics.
- **API** (`guestbookapi.kwingsmedia.com`) — Express + Knex over Postgres; the only thing that talks
  to the database or the object store.

### Two kinds of invitation link

```
/<wedding>/<invitee>   →  the personal link: one household, named on the page,
                          seat allowance already set, RSVP pre-attributed
/<wedding>             →  the open link: shareable anywhere; whoever opens it
                          names themselves and a guest row is created from the reply
```

Both are independently revocable. A shared link can never be unshared, so each URL has an off
switch (`guests.revoked_at`, `weddings.open_revoked_at`) that stops it resolving — routing the
visitor to an expired page — while leaving the guest row and its RSVP history completely intact.
Clearing the timestamp restores the *same* URL rather than minting a new one.

### The invitation page itself

An envelope gate holds the page until the guest clicks to open it, then hands off to a motion
system where CSS holds only the resting state and every transition is an anime.js instance:
split-character headlines, directional reveals that alternate side by side, `clip-path` curtain
wipes over photography, and scroll-scrubbed parallax whose playhead is seeked from the element's
own progress through the viewport. Lenis and the scrub engine share a single `requestAnimationFrame`
loop so both resolve on the same frame. `prefers-reduced-motion` disables all of it and renders the
page in its resting state.

Below the gate: hero, live countdown, love story, gallery, venue and schedule details, optional
background music, and the RSVP form.

---

## Engineering Highlights

**Per-wedding content as one structured document.** Everything beyond the couple/date/venue columns
— hero photo, story chapters, gallery, day-of schedule, music, studio credit — lives in a single
`jsonb` column that the portal edits as one document and the public site merges over built-in
defaults. A new wedding inherits a complete, tasteful page and overrides only what it cares to,
with no table per content type and no per-deployment hardcoding.

**Engagement, not just opens.** `open_count` proves the page was fetched; it says nothing about
whether anyone reached the RSVP at the bottom. The page reports scroll depth and labelled button
presses as `scroll` / `click` events, and the deepest point any visit reached is denormalised onto
the guest row — so the couple sees "read to 90%, never pressed RSVP" without aggregating the event
log on every page load. Depth is only counted after the envelope gate is dismissed, since the gate
locks scroll.

**Passwordless sign-in done carefully.** Login codes and password resets share one `auth_codes`
table that stores only a bcrypt hash of the 6-digit code — a leaked row must not let anyone in.
`attempts` caps guessing, `consumed_at` makes a code single-use rather than valid until expiry, and
the API starts fine without SMTP configured: only those two endpoints answer 503, instead of the
whole service refusing to boot.

**A planner that is genuinely local.** The portal ships a Sri Lankan wedding plan template — nekath,
poruwa decorator, bridal dresser, hewisi drummers — phased 12 months out to the week of, ordered by
what actually blocks what: the nekath fixes the date, the date fixes the venue, the venue fixes
everything else. Every task and budget line is editable and the couple's copy is theirs from the
first change.

**Fail-fast configuration.** Compose refuses to start without `DB_PASSWORD`, `JWT_SECRET` and the S3
keys rather than booting a half-configured API, and CORS is locked to the portal origin instead of
reflecting whatever asks.

**A demo that works before anything exists.** `/demo` renders a finished sample invitation from the
site's built-in content, needing no wedding of its own — which is exactly when a couple most needs
to see what they are buying.

---

## Deployment

Three containers behind the host's existing nginx, all bound to `127.0.0.1` only — nginx terminates
TLS on the host, so even the API's public endpoints (`/api/track`, the open RSVP) sit behind the
same proxy as everything else rather than on a raw port. Postgres and MinIO already run on the host
and are reached over `host.docker.internal`; the Docker bridge range is permitted in `pg_hba.conf`
with `scram-sha-256`, so no server-side change was needed.

| Service | Domain | Loopback port |
|---|---|---|
| `web-ui` | `guestbook.kwingsmedia.com` | `127.0.0.1:3010` |
| `portal-app` | `guestbookportal.kwingsmedia.com` | `127.0.0.1:3011` |
| `portal-api` | `guestbookapi.kwingsmedia.com` | `127.0.0.1:4005` |

---

## Repository Layout

```
portal-api/   Express API — routes/ (auth, weddings, guests, uploads, tracking),
              migrations/ (guests, images, invitation_events, weddings, users,
              auth_codes), s3.js, mailer.js, otp.js
portal-app/   React + Vite admin — pages/ (Dashboard, Weddings, WeddingDetail,
              Guests, GuestDetail, Events, Images, Plan, auth), ContentEditor,
              MediaPicker, QrButton, MusicPicker
web-ui/       Astro SSR invitation site — pages/[wedding]/[invitee], the open
              /[wedding], /demo and /expired; components/ (Envelope, Hero,
              Story, Gallery, Countdown, Details, Rsvp), scripts/motion.js + track.js
deploy/       nginx site configs
```
