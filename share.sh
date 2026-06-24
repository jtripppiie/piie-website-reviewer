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

if curl -fsS "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then
  echo "Reviewer already running on http://localhost:${PORT}; reusing it for sharing."
else
  echo "Starting the reviewer on http://localhost:${PORT} ..."
  PORT="$PORT" node server.js &
  SERVER_PID=$!
  STARTED_SERVER=1

  # Give the server a moment to bind the port before opening the tunnel.
  sleep 2
fi

echo ""
echo "Opening a public Cloudflare tunnel."
echo "Share the https://...trycloudflare.com link that appears below."
echo ""
cloudflared tunnel --url "http://localhost:${PORT}"
