#!/bin/sh
set -e

chown -R node:node /app/backups 2>/dev/null || true

exec gosu node ./bin/docker-www
