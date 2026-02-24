const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, "data", "liturgie.json");

app.use(express.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, "public")));

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      tekst: "Welkom bij de dienst.\n\nStel de liturgie in via /dashboard."
    };
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), "utf8");
  }
}

function readLiturgie() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

function writeLiturgie(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

app.get("/api/get-liturgie", (req, res) => {
  try {
    const data = readLiturgie();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon liturgie niet lezen." });
  }
});

app.post("/api/set-liturgie", (req, res) => {
  try {
    const tekst = req.body.tekst ?? "";
    writeLiturgie({ tekst });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon liturgie niet opslaan." });
  }
});

// Image upload/support
const IMAGE_DATA_FILE = path.join(__dirname, "data", "image.json");
const UPLOADS_DIR = path.join(__dirname, "public", "uploads");

function ensureImageFile() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGE_DATA_FILE)) {
    fs.mkdirSync(path.dirname(IMAGE_DATA_FILE), { recursive: true });
    fs.writeFileSync(IMAGE_DATA_FILE, JSON.stringify({ filename: null }, null, 2), "utf8");
  }
}

function readImageData() {
  ensureImageFile();
  const raw = fs.readFileSync(IMAGE_DATA_FILE, "utf8");
  return JSON.parse(raw);
}

function writeImageData(data) {
  fs.writeFileSync(IMAGE_DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Return current image filename (if any)
app.get("/api/get-image", (req, res) => {
  try {
    const data = readImageData();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon image niet lezen." });
  }
});

// Accept image as data URL in JSON: { filename: "name.jpg", data: "data:<mime>;base64,<...>" }
app.post("/api/set-image", (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!filename || !data) {
      return res.status(400).json({ error: "Ontbrekende bestandsgegevens." });
    }

    const matches = String(data).match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Ongeldig data URI." });
    }

    const b64 = matches[2];
    const buffer = Buffer.from(b64, "base64");

    const cleanName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const destPath = path.join(UPLOADS_DIR, cleanName);
    fs.writeFileSync(destPath, buffer);

    writeImageData({ filename: cleanName });
    res.json({ ok: true, filename: cleanName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon image niet opslaan." });
  }
});

app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
  console.log("Liturgie:  http://localhost:3000/liturgie");
  console.log("Dashboard: http://localhost:3000/dashboard");
  console.log("Image:     http://localhost:3000/image");
});
