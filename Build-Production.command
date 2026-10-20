#!/bin/bash

# Double-click in Finder to build the production website.
cd -- "$(dirname -- "$0")" || exit 1

finish() {
  printf '\n%s\n' "$2"
  read -r -p "Press Return to close… "
  exit "$1"
}

command -v node >/dev/null 2>&1 || finish 1 "Node.js was not found. Install Node.js and try again."
command -v npm >/dev/null 2>&1 || finish 1 "npm was not found. Install Node.js with npm and try again."
[ -d node_modules/vite ] || finish 1 "Dependencies are missing. Run npm ci --include=dev --include=optional in this folder first."

printf 'Building Turbo QA Studio with Node %s…\n\n' "$(node --version)"
npm run build
build_status=$?
[ "$build_status" -eq 0 ] || finish "$build_status" "Production build failed. Check the error above."

finish 0 "Production build completed. Website files are in: $PWD/dist"
