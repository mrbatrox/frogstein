// ============================================================
// SERVER.JS — Backend di Tap Coin
// Qui vive tutta la logica "vera": il client non decide mai
// quanti punti ha. Ogni azione (tap, farm, task, checkin) passa
// da qui, viene validata, e SOLO DOPO viene salvata e restituita.
// ============================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const DB_PATH = path.join(__dirname, "data", "db.json");

// ------------------------------------------------------------
// Storage a file (va benissimo per partire — vedi README per
// come migrare a un vero database quando la community cresce)
// ------------------------------------------------------------
function loadDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { users: {} };
  }
}

function saveDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function todayStr(ts) {
  return new Date(ts || Date.now()).toISOString().slice(0, 10);
}

function defaultUser(id, name) {
  return {
    id: String(id),
    name: name || "Player",
    points: 0,
    tapsToday: 0,
    tapDate: todayStr(),
    farmStartedAt: null,
    completedTasks: [],
    referrerId: null,
    referralsCount: 0,
    wallet: null,
    streak: 0,
    lastCheckin: null,
    createdAt: Date.now(),
  };
}

function getOrCreateUser(db, id, name) {
  if (!db.users[id]) {
    db.users[id] = defaultUser(id, name);
  }
  const u = db.users[id];
  // Reset automatico del contatore tap ad ogni nuovo giorno (UTC)
  if (u.tapDate !== todayStr()) {
    u.tapDate = todayStr();
    u.tapsToday = 0;
  }
  return u;
}

// Assegna punti e, se l'utente ha un referrer, gli accredita
// automaticamente la % di bonus configurata.
function addPoints(db, user, amount) {
  user.points = round2(user.points + amount);
  if (user.referrerId && db.users[user.referrerId]) {
    const bonus = amount * (config.referral.bonusPercent / 100);
    db.users[user.referrerId].points = round2(db.users[user.referrerId].points + bonus);
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function publicState(user) {
  // Solo i campi che servono al frontend, niente di interno
  return {
    id: user.id,
    name: user.name,
    points: user.points,
    tapsToday: user.tapsToday,
    maxTapsPerDay: config.tap.maxTapsPerDay,
    farmStartedAt: user.farmStartedAt,
    completedTasks: user.completedTasks,
    referralsCount: user.referralsCount,
    wallet: user.wallet,
    streak: user.streak,
    lastCheckin: user.lastCheckin,
  };
}

// ------------------------------------------------------------
// Verifica dell'autenticità dei dati Telegram (HMAC).
// Documentazione ufficiale:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// ------------------------------------------------------------
function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const pairs = [];
    for (const [key, value] of params.entries()) {
      pairs.push(`${key}=${value}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (computedHash !== hash) return null;

    const userJson = params.get("user");
    const user = userJson ? JSON.parse(userJson) : null;
    const startParam = params.get("start_param") || null;

    if (!user || !user.id) return null;
    return { id: String(user.id), name: user.first_name || "Player", startParam };
  } catch (e) {
    return null;
  }
}

// Middleware: verifica l'utente Telegram su ogni richiesta.
// In locale (fuori da Telegram, senza initData valido) usa un
// utente "ospite" condiviso, solo per poter testare l'interfaccia:
// NON è sicuro e NON va usato così in produzione con utenti veri.
function authenticate(req, res, next) {
  const initData = req.body.initData || "";
  const verified = verifyInitData(initData);

  if (verified) {
    req.telegramUser = verified;
    return next();
  }

  if (process.env.NODE_ENV !== "production") {
    req.telegramUser = { id: "local_demo", name: "Demo", startParam: null };
    return next();
  }

  return res.status(401).json({ error: "Dati Telegram non validi. Apri l'app da Telegram." });
}

// ------------------------------------------------------------
// ROTTE
// ------------------------------------------------------------

// Config pubblica (nessun segreto dentro: solo testi, timer, task)
app.get("/api/config", (req, res) => {
  res.json(config);
});

// Ingresso nell'app: crea/carica l'utente, gestisce il referral
// se è arrivato tramite link di invito, e restituisce lo stato
// SEMPRE aggiornato salvato sul server (mai quello del browser).
app.post("/api/auth", authenticate, (req, res) => {
  const db = loadDB();
  const { id, name, startParam } = req.telegramUser;
  const user = getOrCreateUser(db, id, name);

  if (
    startParam &&
    !user.referrerId &&
    startParam !== id &&
    db.users[startParam] &&
    Date.now() - user.createdAt < 5000 // solo per un account appena creato
  ) {
    user.referrerId = startParam;
    db.users[startParam].referralsCount += 1;
  }

  saveDB(db);
  res.json(publicState(user));
});

// Tap: massimo N al giorno, il server tiene il conteggio reale.
app.post("/api/tap", authenticate, (req, res) => {
  const db = loadDB();
  const user = getOrCreateUser(db, req.telegramUser.id, req.telegramUser.name);

  if (user.tapsToday >= config.tap.maxTapsPerDay) {
    return res.status(429).json({ error: "Limite giornaliero raggiunto", state: publicState(user) });
  }

  user.tapsToday += 1;
  addPoints(db, user, config.tap.rewardPerTap);
  saveDB(db);
  res.json(publicState(user));
});

// Farming: avvia il ciclo
app.post("/api/farm/start", authenticate, (req, res) => {
  const db = loadDB();
  const user = getOrCreateUser(db, req.telegramUser.id, req.telegramUser.name);

  if (user.farmStartedAt) {
    return res.status(400).json({ error: "Farming già in corso", state: publicState(user) });
  }

  user.farmStartedAt = Date.now();
  saveDB(db);
  res.json(publicState(user));
});

// Farming: riscatta il ciclo (solo se sono passate davvero le ore configurate)
app.post("/api/farm/claim", authenticate, (req, res) => {
  const db = loadDB();
  const user = getOrCreateUser(db, req.telegramUser.id, req.telegramUser.name);

  const durationMs = config.farming.durationHours * 3600 * 1000;
  if (!user.farmStartedAt || Date.now() - user.farmStartedAt < durationMs) {
    return res.status(400).json({ error: "Non ancora pronto", state: publicState(user) });
  }

  addPoints(db, user, config.farming.rewardPerCycle);
  user.farmStartedAt = null;
  saveDB(db);
  res.json(publicState(user));
});

// Task: riscatto una tantum per id
app.post("/api/task/claim", authenticate, (req, res) => {
  const db = loadDB();
  const user = getOrCreateUser(db, req.telegramUser.id, req.telegramUser.name);
  const { taskId } = req.body;

  const task = config.tasks.find(t => t.id === taskId);
  if (!task) return res.status(400).json({ error: "Task inesistente" });
  if (user.completedTasks.includes(taskId)) {
    return res.status(400).json({ error: "Già riscattato", state: publicState(user) });
  }

  user.completedTasks.push(taskId);
  addPoints(db, user, task.reward);
  saveDB(db);
  res.json(publicState(user));
});

// Daily check-in: un riscatto al giorno, streak calcolata dal server
app.post("/api/checkin", authenticate, (req, res) => {
  const db = loadDB();
  const user = getOrCreateUser(db, req.telegramUser.id, req.telegramUser.name);

  const today = todayStr();
  const lastDay = user.lastCheckin ? todayStr(user.lastCheckin) : null;
  if (lastDay === today) {
    return res.status(400).json({ error: "Già ritirato oggi", state: publicState(user) });
  }

  const yesterday = todayStr(Date.now() - 86400000);
  if (lastDay !== yesterday) {
    user.streak = 0; // la serie si è interrotta
  }

  const rewards = config.dailyCheckin.rewards;
  const reward = rewards[Math.min(user.streak, rewards.length - 1)];
  let gained;
  if (reward === "mystery") {
    const { mysteryBoxMin, mysteryBoxMax } = config.dailyCheckin;
    gained = Math.floor(mysteryBoxMin + Math.random() * (mysteryBoxMax - mysteryBoxMin));
  } else {
    gained = reward;
  }

  addPoints(db, user, gained);
  user.streak = (user.streak + 1) % rewards.length;
  user.lastCheckin = Date.now();
  saveDB(db);
  res.json({ ...publicState(user), gained });
});

// Wallet: collegamento (badge una tantum)
app.post("/api/wallet/connect", authenticate, (req, res) => {
  const db = loadDB();
  const user = getOrCreateUser(db, req.telegramUser.id, req.telegramUser.name);
  const { address } = req.body;

  if (!address) return res.status(400).json({ error: "Indirizzo mancante" });

  const firstTime = !user.wallet;
  user.wallet = address;
  if (firstTime) addPoints(db, user, 100);
  saveDB(db);
  res.json(publicState(user));
});

app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});
