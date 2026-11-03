#!/usr/bin/env bash
set -euo pipefail

# Own the production server explicitly so Nitro shutdown cannot hold the test runner open.
mkdir -p artifacts
PORT=3173 HOST=127.0.0.1 node --env-file-if-exists=.env .output/server/index.mjs >artifacts/ci-server.log 2>&1 &
server_pid=$!
trap 'kill -KILL "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true' EXIT
trap 'exit 130' INT TERM

ready=false
for ((attempt = 0; attempt < 60; attempt++)); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    cat artifacts/ci-server.log
    exit 1
  fi
  if curl --silent --fail --max-time 2 http://127.0.0.1:3173/ >/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  cat artifacts/ci-server.log
  exit 1
fi

PW_EXTERNAL_SERVER=1 npx playwright test --global-timeout=720000 "$@"
