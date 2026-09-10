# Verbeterpunten

Analyse van 10 september 2026. Alle punten uit de eerste ronde zijn op dezelfde dag doorgevoerd. Zie [README.md](README.md) voor hoe het programma nu werkt.

## Doorgevoerd

**Bugs en risico's**

- `node_modules` uit git gehaald, `.gitignore` toegevoegd (ook `config.json`, `data/*.json`, `public/uploads/`).
- Service worker is network-first; CSS-wijzigingen komen direct aan op de beamer.
- Upload accepteert alleen JPG, PNG, WebP en GIF tot 15 MB. De server kiest de bestandsnaam zelf en verwijdert de vorige upload.
- Wachtwoord staat op de server (`config.json` of `LITURGIE_WACHTWOORD`). Alle schrijf-routes eisen de header `X-Wachtwoord`.
- Maat-tokens staan in px, dus de berekening van opvulregels klopt.

**Kwaliteit**

- Renderlogica staat één keer in `public/liturgie-render.js`, gebruikt door dashboard en beamerpagina.
- Eén set maat-tokens; het dashboard heeft geen eigen kopie meer.
- Dashboard-preview schaalt het echte 1080x1920-beeld (staand) naar het venster, ook op een telefoon.
- Font Urbanist staat lokaal in `public/fonts/`. Roboto Mono was ongebruikt en is weg.
- Dode CSS, ongebruikte 3 MB corkfoto, testcommentaar en `npm test` verwijderd. `PORT` is instelbaar.
- Manifest heeft iconen (`icon.svg`, `icon-192.png`, `icon-512.png`, `icon-180.png`).

**Functioneel**

- Waarschuwing plus rode markering in het dashboard voor regels die buiten het beamerbeeld vallen.
- `,` en `.` krijgen een smal blokje, alle andere tekens een gewoon blokje. Geen gaten meer.
- Waarschuwing bij het sluiten van het dashboard met niet-opgeslagen wijzigingen, en Ctrl+S om op te slaan.
- Startscherm linkt naar alle vier de pagina's; beheerpagina's hebben een navigatiebalk.
- Beamerpagina's verversen direct na opslaan via Server-Sent Events, polling elke 30 seconden als vangnet.
- Opgelost bij het herschrijven: typen in een lege regel gaf een extra spatie (de placeholder-nbsp telde mee). Regels worden nu ook zonder spaties aan het eind opgeslagen.
- Afbeelding kan verwijderd worden via de uploadpagina.
- Eén bordpagina (`/bord/`) die live schakelt tussen liturgie en afbeelding; schakelaar op het startscherm. Startscherm in dezelfde stijl als het bord.
- Bord werkt door als de server wegvalt: geen foutmeldingen, laatste stand in localStorage, service worker cachet pagina, font, API-antwoorden en afbeelding. Ook na een herstart van de Pi.

## Open

- De beamer (staand, 1080x1920) past ongeveer 12 regels. Als dat te weinig is moeten de maat-tokens in `styles.css` omlaag.
- Bewerkingen op één apparaat zijn niet zichtbaar op een ander open dashboard tot je daar herlaadt.
- Geen automatische tests. Een smoke-test op de API-routes zou de volgende stap zijn.
