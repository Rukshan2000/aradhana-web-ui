# Deploying the Kwings guestbook

Three services behind the host's existing nginx on `164.68.97.187`.

| Service      | Domain                              | Host port (loopback) | Container |
|--------------|-------------------------------------|----------------------|-----------|
| `web-ui`     | `guestbook.kwingsmedia.com`         | `127.0.0.1:3010`     | `:4321` (Astro SSR) |
| `portal-app` | `guestbookportal.kwingsmedia.com`   | `127.0.0.1:3011`     | `:80` (nginx, static) |
| `portal-api` | `guestbookapi.kwingsmedia.com`      | `127.0.0.1:4005`     | `:4000` (Express) |

## Why these ports

From `docker ps` and `ss -tlnp` on the server, `3000`–`3009` and
`4000`–`4004` are already claimed by other projects (`ragama-opticians`,
`dreamhome`, `invoicegen`, `dms-backend`, `travel-*`, `chaty`, `kwingmedia`,
`portfolio`, `greenplus-agro`, `kwings-connect-api`). `4001`, `5000`, `8080`,
`9000`/`9001` (MinIO) and `11434` (ollama) are taken by host processes.
`3010`, `3011` and `4005` were free.

All three bind to `127.0.0.1` only. nginx terminates TLS on the host, so
nothing needs a publicly reachable raw port — this keeps the API's public
endpoints (`/api/track`, the open RSVP) behind the same proxy as everything
else rather than exposed directly.

## What is *not* in this stack

Postgres and MinIO already run on the host and are left alone:

- **Postgres** — `kwings-wedding-invitation` exists and is fully migrated
  (`guests`, `images`, `invitation_events`, `users`, `weddings`,
  `knex_migrations`). The role `kwings_wedding` exists, and `pg_hba.conf`
  already permits `172.16.0.0/12` (the Docker bridge range) over
  `scram-sha-256`, so the container reaches it via `host.docker.internal`
  with no server-side change.
- **MinIO** — on `:9000`, proxied at `minio.kwingsmedia.com`.

## Deploy

```bash
ssh root@164.68.97.187
mkdir -p /var/www/kwings-guestbook && cd /var/www/kwings-guestbook
# copy the repo here (rsync/git), then:

cp .env.example .env
vi .env                    # fill DB_PASSWORD, JWT_SECRET, S3 keys, SMTP_*

docker compose build
docker compose up -d
docker compose ps
```

Generate the JWT secret with `openssl rand -base64 48`. Compose refuses to
start if `DB_PASSWORD`, `JWT_SECRET` or the S3 keys are unset, rather than
booting a half-configured API.

The SMTP block is the exception: leave it blank and the API still starts, but
sign-in codes and password resets answer 503. Gmail needs an App Password
(Google Account → Security → App passwords), not the account password.

The database is already migrated. For future migrations:

```bash
docker compose run --rm portal-api npm run migrate
```

## nginx and TLS

The three vhosts in `deploy/nginx/` are **hand-written, including their TLS
blocks**, and must stay that way.

> **Do not run `certbot --nginx` for these domains.**
> This box has a catch-all vhost in `sites-enabled/kwings-media` with
> `server_name kwingsmedia.com www.kwingsmedia.com *.kwingsmedia.com`. That
> wildcard matches every `*.kwingsmedia.com` subdomain, so certbot's nginx
> *installer* picks that file and rewrites its `ssl_certificate` to the new
> subdomain's cert — silently swapping the main site onto a certificate that
> does not cover it. This happened once and was reverted from
> `/var/lib/letsencrypt/backups/`.

Install and enable:

```bash
cp deploy/nginx/* /etc/nginx/sites-available/
for d in guestbook guestbookportal guestbookapi; do
  ln -sf /etc/nginx/sites-available/$d.kwingsmedia.com \
         /etc/nginx/sites-enabled/$d.kwingsmedia.com
done
nginx -t && systemctl reload nginx
```

Always `nginx -t` before reloading — it is what caught an `http2 on;`
directive that this nginx (1.24) is too old to parse.

Certificates are issued with the **webroot** authenticator and no installer,
so certbot never edits nginx config:

```bash
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot -d guestbook.kwingsmedia.com
```

Each vhost keeps a `location /.well-known/acme-challenge/` on port 80 so
renewals work without touching TLS. All three renewal configs in
`/etc/letsencrypt/renewal/` are set to `authenticator = webroot` and
`installer = None`; verify with `certbot renew --dry-run`.

The API vhost sets `client_max_body_size 16m`. nginx's global default is 1 MB,
which would reject the app's 15 MB music uploads with a 413 before the route
ever ran.

## Routes worth knowing

- `https://guestbook.kwingsmedia.com/` — the product's landing page: what the
  Guest Book is, with links to the sample invitation and to the portal. It used
  to 301 to the portal via an exact-match `location = /`, because the root had
  no wedding slug and fell back to the built-in sample couple. That redirect is
  gone; the root is proxied like every other route.
- `https://guestbook.kwingsmedia.com/demo` — a finished sample invitation
  rendered from `web-ui/src/data/wedding.json`, needing no wedding row. The
  portal links to it from the sidebar and from the create-wedding page. Astro
  gives static routes priority, so it only shadows a real wedding whose slug is
  literally `demo`.

## Build-time vs runtime configuration

This trips people up, so it is worth being explicit:

- **`web-ui` reads `API_BASE` at runtime.** Verified against the built bundle:
  it compiles to a live `import.meta.env.API_BASE` lookup that the node adapter
  fills from the real environment. Repointing the API is a compose edit and a
  restart — no rebuild. It is set to `http://portal-api:4000`, so the public
  site talks to the API over the compose network and the API's address never
  reaches a visitor's browser.
- **`portal-app`'s `VITE_*` vars are inlined at build time.** They are build
  args, not environment. Changing `VITE_API_BASE` or `VITE_SITE_BASE` requires
  `docker compose build portal-app`, not just a restart.

Unlike web-ui, the portal is a browser app, so it must reach the API over the
public internet at `guestbookapi.kwingsmedia.com`. Both hosts sit under
`kwingsmedia.com`, so the `SameSite=Lax` session cookie counts as same-site and
is sent normally; `PORTAL_ORIGIN` locks the API's CORS to the portal origin
(left unset, the API reflects *any* origin).

## Operating

```bash
docker compose logs -f portal-api
docker compose restart web-ui
docker compose down                 # stop
docker compose up -d --build        # redeploy after a code change
```

Each service has a healthcheck; `web-ui` waits for `portal-api` to be healthy
before starting.
