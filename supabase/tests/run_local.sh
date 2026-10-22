#!/usr/bin/env bash
# Checks the migration, seed and row level security on a throwaway local Postgres (needs Postgres 15+ binaries on PATH).
# It starts its own server on a private socket in a temp folder, so it never touches another Postgres on this machine.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
dir="$(mktemp -d)"
port=54329

stop() { pg_ctl -D "$dir/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$dir"; }
trap stop EXIT

initdb -D "$dir/data" -U postgres -A trust >/dev/null
pg_ctl -D "$dir/data" -o "-p $port -k $dir -c listen_addresses=''" -l "$dir/server.log" -w start >/dev/null

psql -h "$dir" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c 'create database cm'
run() { psql -h "$dir" -p "$port" -U postgres -d cm -v ON_ERROR_STOP=1 -q "$@"; }

run -f "$here/tests/local_stub.sql"
run -f "$here/migrations/20261021000000_init.sql"
run -f "$here/seed.sql"
run -f "$here/seed.sql"          # seed must be safe to run twice
run -f "$here/tests/smoke.sql"
