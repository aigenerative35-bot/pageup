#!/usr/bin/env bash
# PageUp — start a local web server.
#
# Why a server and not just double-clicking the HTML: the pages use ES modules,
# which browsers refuse to load over file://. And the admin console shares
# localStorage with the site only when both are served from the same origin —
# so open BOTH from the URL this prints, not from the file system.
set -e
cd "$(dirname "$0")"
PORT="${1:-5173}"

echo
echo "  PageUp — local preview"
echo
echo "  Website : http://localhost:$PORT/index.html"
echo "  Admin   : http://localhost:$PORT/admin.html"
echo
echo "  Open both from these URLs so the admin console and the site share data."
echo "  Ctrl+C to stop."
echo

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT" .
else
  echo "  Neither Python nor Node was found."
  echo "  Install one, or just use the live site:"
  echo "    https://aigenerative35-bot.github.io/pageup/admin.html"
  exit 1
fi
