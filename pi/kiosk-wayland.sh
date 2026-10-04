#!/bin/bash
# Liturgiebord-kiosk: Chromium onder cage (Wayland). Gestart door ~/.bashrc op tty1.

BORD_URL="http://192.168.1.154:3000/bord/"
# Draaiing van de tv: 0 (liggend), 90 of 270 (staand), 180
ROTATE="270"

ORIGIN="${BORD_URL%/bord/}"

# Scherm draaien (eerste uitgang)
OUTPUT=$(wlr-randr 2>/dev/null | awk 'NR==1{print $1}')
if [ -n "$OUTPUT" ]; then
  wlr-randr --output "$OUTPUT" --transform "$ROTATE" 2>/dev/null || true
fi

# Even wachten tot de server antwoordt (max 20 s). Lukt dat niet, dan start Chromium toch:
# de service worker van het bord toont dan de laatst bekende stand.
for i in $(seq 1 20); do
  if timeout 1 bash -c "</dev/tcp/${ORIGIN#http://}" 2>/dev/null; then break; fi
  sleep 1
done

# --unsafely-treat-insecure-origin-as-secure: service workers werken normaal alleen op
# https of localhost; zo mag het ook op het http-adres van de server (offline-vangnet).
exec chromium \
  --ozone-platform=wayland \
  --kiosk \
  --lang=nl \
  --user-data-dir="$HOME/.config/liturgie-kiosk" \
  --unsafely-treat-insecure-origin-as-secure="$ORIGIN" \
  --disable-features=Translate,TranslateUI \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-last-session \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --no-first-run \
  --password-store=basic \
  "$BORD_URL"
