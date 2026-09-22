#!/bin/sh
set -eu
trap 'exit 0' TERM INT
while :; do
    certbot renew --webroot -w /var/www/certbot --quiet || echo 'Certificate renewal failed; inspect certbot logs.' >&2
    sleep 43200 &
    wait $! || true
done
