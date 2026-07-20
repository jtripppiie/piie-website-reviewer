#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  . "$NVM_DIR/nvm.sh"
fi

cd /home/jt/projects/before-after

PORT="${PORT:-3000}"
HEALTH_URL="http://localhost:${PORT}/healthz"

# A launcher click should always serve the code currently in this checkout.
# Reusing an existing Node process leaves the old source loaded in memory.
if health="$(curl -fsS "$HEALTH_URL" 2>/dev/null)"; then
  if [[ "$health" != *'"app":"PIIE Web Reviewer"'* ]]; then
    echo "Port ${PORT} is already being used by another application." >&2
    echo "Stop that application or launch the reviewer with a different PORT." >&2
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

PORT="$PORT" npm run dev
