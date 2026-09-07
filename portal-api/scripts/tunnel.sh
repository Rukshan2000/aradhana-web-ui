#!/usr/bin/env bash
# Opens an SSH tunnel from this local machine to the server so the API can reach
# Postgres and MinIO over localhost (they listen on the server's 127.0.0.1).
#
#   local 5433 -> server 127.0.0.1:5432   (Postgres)
#   local 9100 -> server 127.0.0.1:9000   (MinIO / S3)
#
# Keep this running in one terminal, then run `npm run migrate` / `npm run dev`
# in another. Ctrl-C to close the tunnel.
set -euo pipefail

SSH_HOST="${SSH_HOST:-root@164.68.97.187}"

echo "Opening tunnel to ${SSH_HOST} ..."
echo "  Postgres : localhost:5433 -> 127.0.0.1:5432"
echo "  MinIO/S3 : localhost:9100 -> 127.0.0.1:9000"
echo "Leave this open; Ctrl-C to stop."

exec ssh -N \
  -o ServerAliveInterval=30 \
  -o ExitOnForwardFailure=yes \
  -L 5433:127.0.0.1:5432 \
  -L 9100:127.0.0.1:9000 \
  "${SSH_HOST}"
