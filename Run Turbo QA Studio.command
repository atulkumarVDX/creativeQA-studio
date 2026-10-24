#!/bin/zsh
cd "$(dirname "$0")"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 22.22.2 || exit 1
fi
npm run dev
