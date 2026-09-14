#!/bin/bash

# Double-click in Finder, or run this file from Terminal.
cd -- "$(dirname -- "$0")" || exit 1

fail() {
  printf '\n%s\n' "$1"
  read -r -p "Press Return to close… "
  exit 1
}

supported_node() {
  "$1" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)' 2>/dev/null
}

# Finder inherits the default shell's PATH, which may select an older Node.
# Prefer that PATH when compatible, otherwise use an existing newer runtime.
if ! supported_node "$(command -v node)"; then
  for node_candidate in \
    "$HOME"/.nvm/versions/node/*/bin/node \
    /opt/homebrew/opt/node/bin/node \
    /opt/homebrew/opt/node@24/bin/node \
    /opt/homebrew/opt/node@22/bin/node \
    "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; do
    if [ -x "$node_candidate" ] && supported_node "$node_candidate"; then
      export PATH="$(dirname -- "$node_candidate"):$PATH"
      break
    fi
  done
fi
supported_node "$(command -v node)" || fail "Node.js 22.13 or newer is required. With nvm, run: nvm install 22"
command -v npm >/dev/null 2>&1 || fail "npm is required. Install Node.js with npm, then try again."
printf 'Using Node.js %s\n' "$(node --version)"
[ -d node_modules/vinext ] || fail "Dependencies are missing. Run npm run install:ci in this folder, then try again."

if /usr/bin/nc -z 127.0.0.1 5173 2>/dev/null; then
  fail "Port 5173 is already in use. Stop the existing server before launching again."
fi

printf '\nStarting Turbo QA Studio at http://127.0.0.1:5173\nKeep this Terminal open. Press Control-C to stop the server.\n\n'

# Open the browser once the server responds; leave npm in the foreground so
# Terminal's Control-C stops it normally.
(
  for ((attempt = 0; attempt < 120; attempt++)); do
    if /usr/bin/curl --silent --output /dev/null --max-time 2 http://127.0.0.1:5173; then
      /usr/bin/open http://127.0.0.1:5173
      exit
    fi
    sleep 1
  done
  printf '\nBrowser launch timed out. Use the URL printed by the server.\n'
) &
browser_waiter=$!
trap 'kill "$browser_waiter" 2>/dev/null || true' EXIT

npm run dev -- --hostname 127.0.0.1
server_status=$?
if [ "$server_status" -ne 0 ] && [ "$server_status" -ne 130 ]; then
  fail "The server stopped with an error. Check the output above."
fi
