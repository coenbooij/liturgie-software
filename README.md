# Liturgie Digitaal

Digitaal liturgiebord voor kerkdiensten. Een beamer of scherm toont de liturgie (psalm- en liednummers) in de stijl van een klassiek letterbord: witte letters in zwarte blokjes op een bruine achtergrond, met een zwarte lijn onder elke regel. De koster vult de liturgie in via een dashboard op telefoon of laptop; het scherm ververst direct.

Daarnaast kan een losse afbeelding fullscreen getoond worden op een tweede pagina.

Openstaande en afgeronde verbeterpunten staan in [VERBETERPUNTEN.md](VERBETERPUNTEN.md).

## Starten

```bash
npm install
npm start
```

De server print bij het starten de adressen waarop hij bereikbaar is, ook het LAN-adres voor andere apparaten in het kerknetwerk.

Vereisten: Node.js (getest met v26) en npm. Geen internet nodig: het font staat lokaal in `public/fonts/`.

## Op de server zetten

Kopieer de hele map (inclusief `node_modules/`) naar de server-pc en draai daar `npm start`. Deze bestanden zijn per installatie en staan niet in git:

| Bestand | Wat | Wordt aangemaakt |
|---|---|---|
| `config.json` | Poort en wachtwoord, zie `config.example.json` | Handmatig. Zonder dit bestand geldt poort 3000 en wachtwoord `0404`. |
| `data/liturgie.json` | De huidige liturgie | Door de server bij eerste opslag |
| `data/image.json` | Naam van de huidige afbeelding | Door de server bij eerste upload |
| `data/scherm.json` | Wat het bord toont: `liturgie` of `afbeelding` | Door de server bij eerste keer schakelen |
| `public/uploads/` | De geüploade afbeelding | Door de server |

Wachtwoord instellen: kopieer `config.example.json` naar `config.json` en pas `wachtwoord` aan. Omgevingsvariabelen `PORT` en `LITURGIE_WACHTWOORD` gaan boven het bestand.

## Pagina's

| URL | Wat | Voor wie |
|---|---|---|
| `/` | Startscherm: schakelaar "Het bord toont" (liturgie of afbeelding) plus knoppen naar de twee beheerpagina's. Schakelen vraagt het wachtwoord. | Beheerder |
| `/bord/` | Het scherm zelf. Toont de liturgie als letterbord of de afbeelding fullscreen, afhankelijk van de schakelaar. Ververst direct na een wijziging, elke 30 seconden als vangnet. Cursor verborgen. | Bord-pc (fullscreen in browser, staand 1080x1920) |
| `/dashboard/` | Liturgie bewerken, met wachtwoordgate. Regels zijn direct bewerkbaar in een preview op schaal van het bord. Opslaan met de knop of Ctrl+S. De koster zet deze op het startscherm van de telefoon. | Koster |
| `/dashboard/image.html` | Afbeelding uploaden of verwijderen. Zelfde wachtwoord. | Beheerder |
| `/liturgie/`, `/image/` | Oude adressen, sturen door naar `/bord/`. | |

## Hoe het in elkaar zit

```
server.js                   Express 5, alle API-routes, SSE, auth
config.example.json         Voorbeeld voor config.json
data/                       JSON-opslag (niet in git)
public/                     Statisch, geen build-stap
  index.html                Startscherm + registratie service worker
  styles.css                Alle styling, incl. de blok-tokens (--lit-*) en @font-face
  liturgie-render.js        Gedeelde renderlogica (tekst -> blokjes, opvulregels, overflow)
  bord/index.html           Het scherm: liturgie of afbeelding, schakelt live
  dashboard/index.html      Editor (preview, contenteditable, opslaan)
  dashboard/image.html      Uploadpagina
  dashboard/auth.js         Wachtwoordgate, gedeeld door start- en beheerpagina's
  liturgie/, image/         Doorsturen naar /bord/
  fonts/                    Urbanist (woff2, lokaal)
  uploads/                  Geüploade afbeelding (niet in git)
  manifest.json, sw.js      PWA-bestanden
  icon.svg, icon-*.png      App-icoon
```

### Dataflow

1. Dashboard laadt `GET /api/get-liturgie` en rendert elke regel als een `contenteditable` div.
2. Bij opslaan leest het dashboard de tekst terug uit de DOM en stuurt `POST /api/set-liturgie` met het wachtwoord in de header `X-Wachtwoord`.
3. De server schrijft `data/liturgie.json` weg en stuurt een `liturgie`-event naar alle open bordpagina's via Server-Sent Events (`/api/events`).
4. Het bord haalt de tekst opnieuw op en rendert.

De schakelaar op het startscherm werkt net zo: `POST /api/set-scherm` schrijft `data/scherm.json` en stuurt een `scherm`-event, waarna het bord wisselt tussen liturgie en afbeelding zonder herladen.

Voor afbeeldingen geldt hetzelfde patroon: `POST /api/set-image` ontvangt een data-URL, controleert het type (JPG, PNG, WebP, GIF, max 15 MB), schrijft het bestand als `achtergrond-<tijd>.<ext>` naar `public/uploads/`, verwijdert de vorige upload en stuurt een `image`-event.

### Rendering van het letterbord

De tekst is platte tekst met regeleinden. `liturgie-render.js` bepaalt per teken de opmaak:

| Teken | Class | Uiterlijk |
|---|---|---|
| spatie | `.space` | Transparant, vaste breedte |
| `:` `;` `,` `.` | `.semicolon` | Smal zwart blokje, teken gecentreerd |
| al het andere | `.letter-block` | Zwart blokje, wit teken |

Alles wordt in hoofdletters getoond via `text-transform: uppercase`. Na de echte regels vult de renderer de rest van het scherm met lege regels zodat de lijntjes doorlopen tot onderaan. Regels die buiten het beamerbeeld vallen krijgen de class `buiten-scherm`; het dashboard kleurt ze rood en toont een waarschuwing.

De maten (fontgrootte, blokhoogte, negatieve marges om blokjes uit te lijnen) staan als CSS custom properties in px op `body` in `styles.css`. Voor schermen smaller dan 768px is er een kleinere set, die niet geldt op het dashboard omdat daar het 1080x1920-ontwerp geschaald wordt.

### Dashboard-editor

- Elke regel is een `contenteditable` div. Enter is geblokkeerd, pijltjes omhoog/omlaag springen naar de vorige/volgende regel. Plakken voegt alleen platte tekst op de huidige regel in.
- Backspace en Delete worden zelf afgehandeld zodat de blokjes-opmaak niet stuk gaat. Na elke toetsaanslag wordt de regel opnieuw opgemaakt en de caret teruggezet.
- Bij het verlaten van de pagina met niet-opgeslagen wijzigingen vraagt de browser om bevestiging.
- Het wachtwoord wordt gecontroleerd via `POST /api/login` en bewaard in `sessionStorage`. Bij een 401 op opslaan verschijnt de gate opnieuw.

## API

| Methode | Pad | Auth | Body | Antwoord |
|---|---|---|---|---|
| POST | `/api/login` | | `{ "wachtwoord": "..." }` | `{ "ok": true }` of 401 |
| GET | `/api/get-liturgie` | | | `{ "tekst": "..." }` |
| POST | `/api/set-liturgie` | header | `{ "tekst": "..." }` | `{ "ok": true }` |
| GET | `/api/get-image` | | | `{ "filename": "..." \| null }` |
| POST | `/api/set-image` | header | `{ "data": "data:image/jpeg;base64,..." }` | `{ "ok": true, "filename": "..." }` |
| POST | `/api/clear-image` | header | `{}` | `{ "ok": true }` |
| GET | `/api/get-scherm` | | | `{ "modus": "liturgie" \| "afbeelding" }` |
| POST | `/api/set-scherm` | header | `{ "modus": "afbeelding" }` | `{ "ok": true, "modus": "..." }` |
| GET | `/api/events` | | | SSE-stream met events `liturgie`, `image` en `scherm` |

"header" betekent: `X-Wachtwoord: <wachtwoord>`. Fouten geven een 4xx/5xx met `{ "error": "..." }`.

## PWA

Er zijn twee manifesten, dus twee installeerbare apps:

| Toegevoegd vanaf | App | Opent op |
|---|---|---|
| `/` | "Liturgie Digitaal" (`public/manifest.json`) | het startscherm met de schakelaar |
| `/dashboard/` | "Liturgie bewerken" (`public/dashboard/manifest.json`) | direct het dashboard, voor de koster |

De koster opent dus `/dashboard/` op de telefoon en kiest "Zet op beginscherm". `sw.js` maakt de site installeerbaar. De service worker is network-first: hij haalt altijd de nieuwste versie van de server en gebruikt de cache alleen als de server niet bereikbaar is. API-calls en uploads gaan er nooit doorheen.
