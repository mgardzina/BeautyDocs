#!/bin/sh
set -eu
cert=/etc/letsencrypt/live/beautydocs.pl/fullchain.pem
cp /etc/beautydocs-nginx/http.conf /etc/nginx/conf.d/default.conf
if [ -s "$cert" ]; then
    cat /etc/beautydocs-nginx/https.conf >> /etc/nginx/conf.d/default.conf
else
    echo 'Starting HTTP certificate bootstrap. Issue the certificate, then restart nginx.'
fi
nginx -t
# Certbot renews the shared files; reload only after a certificate changes.
(
    previous=$(sha256sum "$cert" 2>/dev/null || true)
    while sleep 60; do
        current=$(sha256sum "$cert" 2>/dev/null || true)
        if [ -n "$current" ] && [ "$current" != "$previous" ]; then
            cp /etc/beautydocs-nginx/http.conf /etc/nginx/conf.d/default.conf
            cat /etc/beautydocs-nginx/https.conf >> /etc/nginx/conf.d/default.conf
            if nginx -t && nginx -s reload; then previous=$current; fi
        fi
    done
) &
exec nginx -g 'daemon off;'
