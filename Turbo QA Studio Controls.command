#!/bin/zsh

# Double-click in Finder or run from Terminal.
cd "$(dirname "$0")" || exit 1

APP_ROOT="$PWD"
SERVER_PATTERN="$APP_ROOT/scripts/preview-stack.mjs"
RENDER_PATTERN='ffmpeg.*turbo-(video-render|preview-request)-'

show_status() {
  local found=0
  if pgrep -fal "$SERVER_PATTERN"; then found=1; fi
  if pgrep -fal "$RENDER_PATTERN"; then found=1; fi
  if (( found == 0 )); then
    echo "No Turbo QA Studio server or preview render is running."
  fi
}

stop_app() {
  local pids
  pids=$(pgrep -f "$SERVER_PATTERN"; pgrep -f "$RENDER_PATTERN")
  if [[ -z "$pids" ]]; then
    echo "No Turbo QA Studio server or preview render is running."
    return
  fi
  echo "Stopping Turbo QA Studio processes: ${pids//$'\n'/, }"
  # TERM lets the preview stack clean up its children before anything is forced.
  echo "$pids" | sort -u | xargs kill -TERM 2>/dev/null
  for _ in {1..5}; do
    sleep 1
    pids=$(pgrep -f "$SERVER_PATTERN"; pgrep -f "$RENDER_PATTERN")
    [[ -z "$pids" ]] && { echo "Stopped."; return; }
  done
  echo "Some processes did not stop after 5 seconds; leaving them visible for manual review:"
  show_status
}

case "${1:-menu}" in
  start)
    exec "$(dirname "$0")/Run Turbo QA Studio.command"
    ;;
  stop)
    stop_app
    ;;
  status)
    show_status
    ;;
  menu)
    echo "Turbo QA Studio controls"
    echo "1) Start"
    echo "2) Stop server and preview renders"
    echo "3) Check status"
    read -r "choice?Choose 1, 2, or 3: "
    case "$choice" in
      1) exec "$(dirname "$0")/Run Turbo QA Studio.command" ;;
      2) stop_app ;;
      3) show_status ;;
      *) echo "No action taken." ;;
    esac
    ;;
  *)
    echo "Usage: $0 [start|stop|status]"
    exit 2
    ;;
esac

echo
read -r "_?Press Return to close… "
