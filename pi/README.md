# Raspberry Pi als bord

Elk bord is een tv met een Raspberry Pi (getest: Pi 3 Model B+ met Raspberry Pi OS Lite "trixie" op liturgie-bord-2 en "bookworm" op liturgie-bord-1, Samsung-tv). De Pi logt automatisch in op tty1 en start Chromium in kioskmodus onder `cage` (een minimale Wayland-compositor) op `http://<server-ip>:3000/bord/`. Geen desktop, geen display manager, geen X.

## Installatie op een nieuwe Pi

1. Raspberry Pi OS Lite installeren; gebruiker `pi`, wifi en ssh via de Imager instellen.
2. Pakketten:

   ```bash
   sudo apt update && sudo apt full-upgrade -y
   sudo apt install --no-install-recommends cage chromium wlr-randr x11-apps -y
   ```

   (`x11-apps` alleen voor `xcursorgen`, om de muisaanwijzer onzichtbaar te maken.)

3. Autologin op de console: `sudo raspi-config` > System Options > Boot / Auto Login > Console Autologin.
4. `kiosk-wayland.sh` uit deze map naar `/home/pi/kiosk-wayland.sh` kopiëren en uitvoerbaar maken (`chmod +x`). Bovenin `BORD_URL` en `ROTATE` controleren (90 of 270 voor staand).
5. Onzichtbare muisaanwijzer:

   ```bash
   mkdir -p ~/.icons/blank/cursors && cd ~/.icons/blank
   python3 -c 'import zlib,struct;c=lambda t,d:struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff);open("blank.png","wb").write(b"\x89PNG\r\n\x1a\n"+c(b"IHDR",struct.pack(">IIBBBBB",1,1,8,6,0,0,0))+c(b"IDAT",zlib.compress(b"\0"*5))+c(b"IEND",b""))'
   echo "24 0 0 blank.png" > blank.cfg && printf "[Icon Theme]\nName=blank\n" > index.theme
   xcursorgen blank.cfg cursors/default && for n in left_ptr arrow pointer text; do ln -sf default cursors/$n; done
   ```

6. Onderaan `/home/pi/.bashrc` toevoegen:

   ```bash
   # Liturgiebord: op tty1 (autologin) de kiosk starten (cage + Chromium, Wayland), en
   # herstarten als hij stopt. Bestaat ~/kiosk.stop, dan niets starten (onderhoud).
   if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
       if [ ! -f ~/kiosk.stop ]; then
           export XCURSOR_PATH="$HOME/.icons" XCURSOR_THEME=blank XCURSOR_SIZE=24
           while true; do
               cage -- ~/kiosk-wayland.sh > ~/kiosk.log 2>&1
               sleep 3
           done
       fi
   fi
   ```

7. Herstarten. Het bord komt op zodra de server bereikbaar is; daarna ook zonder server.

## Waarom zo

- **Geen X.** Op deze Pi 3 met een Samsung-tv gaf Xorg een zwart beeld (X dacht dat alles goed was, de tv toonde niets, ook met softwarerendering en in andere beeldmodi). Onder Wayland (cage, wlroots) werkt het wel. De oorspronkelijke opzet met `sudo xinit` liep bovendien vast omdat sudo om een wachtwoord vroeg.
- **Draaien met `wlr-randr`** vanuit het kioskscript; cage neemt de kernel-"panel orientation" niet over. `ROTATE="90"` of `"270"` voor staand.
- **Eigen Chromium-profiel, geen incognito.** Incognito gooit de service worker en localStorage weg bij elke start. Profiel: `~/.config/liturgie-kiosk`.
- **`--unsafely-treat-insecure-origin-as-secure`.** Service workers werken normaal alleen op https of localhost. Met deze vlag mag het ook op het http-adres van de server, zodat het bord na een herstart zonder server de laatste stand toont.
- **`--lang=nl --disable-features=Translate`** tegen de vertaalpopup van Chromium.
- **Onzichtbare cursor** via een leeg Xcursor-thema; cage zelf heeft daar geen optie voor.
- **Wachten op de server (max 20 s)** voordat Chromium start. Lukt het niet, dan start Chromium toch en toont de service worker de laatste stand.

## Beheer op afstand

- `ssh pi@liturgie-bord-2` (of het IP). Log: `~/kiosk.log`.
- Kiosk herstarten zonder reboot: `kill $(pgrep -x cage)`. De lus in `.bashrc` start hem binnen 3 seconden opnieuw.
- Kiosk tijdelijk uit (onderhoud): `touch ~/kiosk.stop` en de tty1-sessie herstarten met `kill -9 $(pgrep -t tty1 -x bash)`. Weer aan: bestand verwijderen en hetzelfde kill-commando.
- URL of draairichting aanpassen: `nano ~/kiosk-wayland.sh`, daarna de kiosk herstarten.
