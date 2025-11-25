const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, "data", "liturgie.json");

app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
  console.log("Liturgie:  http://localhost:3000/liturgie");
  console.log("Dashboard: http://localhost:3000/dashboard");
});