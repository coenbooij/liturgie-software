const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, "config.json");
const DATA_DIR = path.join(ROOT, "data");
const LITURGIE_FILE = path.join(DATA_DIR, "liturgie.json");
const IMAGE_DATA_FILE = path.join(DATA_DIR, "image.json");
const SCHERM_FILE = path.join(DATA_DIR, "scherm.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

const DEFAULT_CONFIG = { port: 3000, wachtwoord: "0404" };
const DEFAULT_LITURGIE = {
  tekst: "Welkom bij de dienst.\n\nStel de liturgie in via /dashboard.",
};
const DEFAULT_IMAGE = { filename: null };
// Wat het bord toont: "liturgie" of "afbeelding"
const DEFAULT_SCHERM = { modus: "liturgie" };
const SCHERM_MODI = ["liturgie", "afbeelding"];

// Toegestane afbeeldingstypes: MIME -> extensie
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// ---------- Config ----------

function loadConfig() {
  let fileConfig = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    } catch (err) {
      console.error("config.json is geen geldige JSON, standaardwaarden worden gebruikt:", err.message);
    }
  }
  return {
    port: Number(process.env.PORT) || Number(fileConfig.port) || DEFAULT_CONFIG.port,
    wachtwoord: process.env.LITURGIE_WACHTWOORD || fileConfig.wachtwoord || DEFAULT_CONFIG.wachtwoord,
  };
}

const config = loadConfig();

// ---------- JSON-opslag ----------

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`Kon ${path.basename(file)} niet lezen, standaardwaarde gebruikt:`, err.message);
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function readLiturgie() {
  return readJson(LITURGIE_FILE, DEFAULT_LITURGIE);
}

function readImageData() {
  return readJson(IMAGE_DATA_FILE, DEFAULT_IMAGE);
}

function readScherm() {
  const data = readJson(SCHERM_FILE, DEFAULT_SCHERM);
  return SCHERM_MODI.includes(data.modus) ? data : DEFAULT_SCHERM;
}

function removeUpload(filename) {
  if (!filename) return;
  const target = path.join(UPLOADS_DIR, path.basename(filename));
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (err) {
    console.error("Kon oude upload niet verwijderen:", err.message);
  }
}

// ---------- Server-Sent Events ----------
// Beamerpagina's luisteren hierop en verversen direct na een wijziging.

const sseClients = new Set();

function broadcast(event) {
  for (const client of sseClients) {
    client.write(`event: ${event}\ndata: {}\n\n`);
  }
}

setInterval(() => {
  for (const client of sseClients) client.write(": ping\n\n");
}, 25000).unref();

// ---------- Auth ----------

function requireAuth(req, res, next) {
  const given = req.get("x-wachtwoord") || "";
  if (given !== config.wachtwoord) {
    return res.status(401).json({ error: "Onjuist wachtwoord." });
  }
  next();
}

// ---------- App ----------

const app = express();
const jsonSmall = express.json({ limit: "100kb" });
const jsonLarge = express.json({ limit: "25mb" });

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use(express.static(PUBLIC_DIR));

app.post("/api/login", jsonSmall, (req, res) => {
  const wachtwoord = String(req.body?.wachtwoord ?? "");
  if (wachtwoord !== config.wachtwoord) {
    return res.status(401).json({ error: "Onjuist wachtwoord." });
  }
  res.json({ ok: true });
});

app.get("/api/get-liturgie", (req, res) => {
  res.json(readLiturgie());
});

app.post("/api/set-liturgie", jsonSmall, requireAuth, (req, res) => {
  const tekst = req.body?.tekst;
  if (typeof tekst !== "string") {
    return res.status(400).json({ error: "Veld 'tekst' moet een string zijn." });
  }
  try {
    writeJson(LITURGIE_FILE, { tekst });
    broadcast("liturgie");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon liturgie niet opslaan." });
  }
});

app.get("/api/get-image", (req, res) => {
  res.json(readImageData());
});

// Body: { data: "data:<mime>;base64,<...>" }. Bestandsnaam wordt door de server bepaald.
app.post("/api/set-image", jsonLarge, requireAuth, (req, res) => {
  const data = req.body?.data;
  if (typeof data !== "string") {
    return res.status(400).json({ error: "Ontbrekende bestandsgegevens." });
  }

  const matches = data.match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!matches) {
    return res.status(400).json({ error: "Ongeldige data-URL." });
  }

  const mime = matches[1].toLowerCase();
  const ext = IMAGE_TYPES[mime];
  if (!ext) {
    return res.status(400).json({ error: "Alleen JPG, PNG, WebP of GIF is toegestaan." });
  }

  const buffer = Buffer.from(matches[2], "base64");
  if (buffer.length === 0) {
    return res.status(400).json({ error: "Leeg bestand." });
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: "Afbeelding is groter dan 15 MB." });
  }

  try {
    const previous = readImageData().filename;
    const filename = `achtergrond-${Date.now()}.${ext}`;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    writeJson(IMAGE_DATA_FILE, { filename });
    if (previous && previous !== filename) removeUpload(previous);
    broadcast("image");
    res.json({ ok: true, filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon afbeelding niet opslaan." });
  }
});

app.post("/api/clear-image", jsonSmall, requireAuth, (req, res) => {
  try {
    const previous = readImageData().filename;
    writeJson(IMAGE_DATA_FILE, DEFAULT_IMAGE);
    removeUpload(previous);
    broadcast("image");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon afbeelding niet verwijderen." });
  }
});

app.get("/api/get-scherm", (req, res) => {
  res.json(readScherm());
});

app.post("/api/set-scherm", jsonSmall, requireAuth, (req, res) => {
  const modus = req.body?.modus;
  if (!SCHERM_MODI.includes(modus)) {
    return res.status(400).json({ error: "Modus moet 'liturgie' of 'afbeelding' zijn." });
  }
  try {
    writeJson(SCHERM_FILE, { modus });
    broadcast("scherm");
    res.json({ ok: true, modus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon schermmodus niet opslaan." });
  }
});

app.get("/api/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

// ---------- Start ----------

function lanAddresses() {
  const result = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) result.push(entry.address);
    }
  }
  return result;
}

app.listen(config.port, () => {
  const hosts = ["localhost", ...lanAddresses()];
  console.log("Liturgie Digitaal draait.");
  for (const host of hosts) {
    console.log(`  http://${host}:${config.port}`);
  }
  console.log("Pagina's: /bord (het scherm), / (start en schakelen), /dashboard (liturgie bewerken)");
  if (config.wachtwoord === DEFAULT_CONFIG.wachtwoord) {
    console.log("Let op: standaardwachtwoord in gebruik. Zet een eigen wachtwoord in config.json.");
  }
});
