# Public invitation site (web-ui, Astro SSR) -> 127.0.0.1:3010
#
# Written by hand rather than by `certbot --nginx`. This box has a catch-all
# `server_name kwingsmedia.com www.kwingsmedia.com *.kwingsmedia.com` vhost
# (sites-enabled/kwings-media); certbot's nginx installer matches that wildcard
# for these subdomains and writes the certificate into it, which swaps the main
# site's certificate out from under it. Renewals use webroot, below.
server {
    listen 443 ssl;
    server_name guestbook.kwingsmedia.com;

    ssl_certificate     /etc/letsencrypt/live/guestbook.kwingsmedia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/guestbook.kwingsmedia.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # The bare root used to 301 here to the portal: it had no wedding slug and
    # fell back to rendering the sample couple, so the product's own address
    # looked like one stranger's wedding. `/` is now the product's landing
    # page, so it is proxied like every other route.
    #
    # That old redirect was a *permanent* one, which browsers cache and keep
    # honouring without ever asking again — so visitors who saw it once still
    # land on the portal even though the server stopped sending it. Nothing
    # here can reach into a browser that already cached it (the request never
    # leaves the machine), but this exact-match block keeps the root
    # uncacheable from now on, so the next time `/` changes it changes for
    # everyone immediately. An exact-match location does not inherit the
    # prefix block's directives, so the proxy_* lines are repeated here.
    location = / {
        add_header Cache-Control "no-store, must-revalidate" always;
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# `www.` over TLS, redirected to the bare hostname rather than served in
# parallel. One canonical address keeps invitation links, the tracker's
# same-origin /track.json POSTs and the session cookie all on one host — two
# live hostnames would mean a guest opening the www copy reports against a
# different origin than the link the couple actually sent.
#
# The certificate is the guestbook one, expanded to cover both names:
#   certbot certonly --webroot -w /var/www/certbot \
#     --cert-name guestbook.kwingsmedia.com \
#     -d guestbook.kwingsmedia.com -d www.guestbook.kwingsmedia.com --expand
# Without that expansion this name falls through to the catch-all
# kwings-media vhost and fails the handshake outright.
server {
    listen 443 ssl;
    server_name www.guestbook.kwingsmedia.com;

    ssl_certificate     /etc/letsencrypt/live/guestbook.kwingsmedia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/guestbook.kwingsmedia.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://guestbook.kwingsmedia.com$request_uri;
}

# `www.` on :80 as well as the apex — without it the ACME challenge for the www
# name falls through to the catch-all kwings-media vhost and the certificate
# cannot be issued or renewed for it.
server {
    listen 80;
    server_name guestbook.kwingsmedia.com www.guestbook.kwingsmedia.com;

    # Kept on :80 so `certbot renew --webroot` works without touching TLS.
    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    location / { return 301 https://$host$request_uri; }
}
