#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  . "$NVM_DIR/nvm.sh"
fi

cd /home/jt/projects/before-after

if curl -fsS http://localhost:3000/healthz >/dev/null 2>&1; then
  echo "Reviewer already running on http://localhost:3000"
  exit 0
fi

npm run dev