#!/usr/bin/env bash
# Run the PIIE Web Reviewer locally and expose it with a free Cloudflare quick
# tunnel. Your data stays on this machine. cloudflared prints a public
# https://...trycloudflare.com URL you can share while this is running.
#
# Usage:  npm run share      (or)   bash share.sh
# Stop:   press Ctrl+C  (this also stops the local server)
set -euo pipefail

PORT="${PORT:-3000}"
STARTED_SERVER=0

cleanup() {
  if [[ "$STARTED_SERVER" = "1" && -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. Install it, then run this again." >&2
  exit 1
fi

HEALTH_URL="http://localhost:${PORT}/healthz"
if health="$(curl -fsS "$HEALTH_URL" 2>/dev/null)"; then
  if [[ "$health" != *'"app":"PIIE Web Reviewer"'* ]]; then
    echo "Port ${PORT} is already being used by another application." >&2
    exit 1
  fi

  echo "Stopping the previously running reviewer so the latest code is loaded..."
  mapfile -t pids < <(lsof -t -iTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)
  if [[ "${#pids[@]}" -eq 0 ]]; then
    echo "Could not identify the reviewer process on port ${PORT}." >&2
    exit 1
  fi
  kill "${pids[@]}"

  for _ in {1..30}; do
    if ! curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
fi

echo "Starting the reviewer on http://localhost:${PORT} ..."
PORT="$PORT" node server.js &
SERVER_PID=$!
STARTED_SERVER=1

# Give the server a moment to bind the port before opening the tunnel.
sleep 2

echo ""
echo "Opening a public Cloudflare tunnel."
echo "Share the https://...trycloudflare.com link that appears below."
echo ""
cloudflared tunnel --url "http://localhost:${PORT}"
