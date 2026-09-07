# API (portal-api) -> 127.0.0.1:4005
#
# Written by hand rather than by `certbot --nginx`. This box has a catch-all
# `server_name kwingsmedia.com www.kwingsmedia.com *.kwingsmedia.com` vhost
# (sites-enabled/kwings-media); certbot's nginx installer matches that wildcard
# for these subdomains and writes the certificate into it, which swaps the main
# site's certificate out from under it. Renewals use webroot, below.
server {
    listen 443 ssl;
    server_name guestbookapi.kwingsmedia.com;

    ssl_certificate     /etc/letsencrypt/live/guestbookapi.kwingsmedia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/guestbookapi.kwingsmedia.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # The app caps music uploads at 15MB; nginx defaults to 1m, which would
    # 413 them before the route ever ran.
    client_max_body_size 16m;

    location / {
        proxy_pass http://127.0.0.1:4005;
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

server {
    listen 80;
    server_name guestbookapi.kwingsmedia.com;

    # Kept on :80 so `certbot renew --webroot` works without touching TLS.
    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    location / { return 301 https://$host$request_uri; }
}
