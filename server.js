// server.js
// Backend per la Telegram Mini App tap-to-earn.
// Gestisce: validazione dati Telegram, punteggio con sistema "energia" anti-cheat,
// referral, leaderboard. Storage semplice su file JSON (facile da migrare su un DB vero in seguito).

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// ---- Config di gioco (modifica questi valori per bilanciare il gioco) ----
const MAX_ENERGY = 1000;          // energia massima
const ENERGY_REGEN_PER_SEC = 1;   // energia recuperata al secondo
const REFERRAL_BONUS = 500;       // punti bonus una tantum per chi invita ed è invitato
const MAX_TAPS_PER_REQUEST = 200; // limite di sicurezza per singola richiesta

// ---- Storage minimale su file JSON ----
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ---- Validazione dati Telegram WebApp (initData) ----
// Vedi: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
function validateInitData(initData) {
  if (!BOT_TOKEN) {
    // Modalità sviluppo senza bot token configurato: NON usare in produzione.
    console.warn('ATTENZIONE: BOT_TOKEN non impostato, validazione saltata (solo per test locali).');
    const params = new URLSearchParams(initData);
    const userRaw = params.get('user');
    return userRaw ? JSON.parse(userRaw) : null;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  const pairs = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  // Controllo anti-replay: rifiuta initData più vecchi di 24 ore
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (Date.now() / 1000 - authDate > 86400) return null;

  const userRaw = params.get('user');
  return userRaw ? JSON.parse(userRaw) : null;
}

function getOrCreateUser(db, tgUser) {
  const id = String(tgUser.id);
  if (!db.users[id]) {
    db.users[id] = {
      id,
      username: tgUser.username || tgUser.first_name || 'Player',
      score: 0,
      energy: MAX_ENERGY,
      lastEnergyUpdate: Date.now(),
      referralCode: id, // semplice: il referral code coincide con l'id telegram
      referredBy: null,
      referralClaimed: false,
      createdAt: Date.now(),
    };
  }
  return db.users[id];
}

function refreshEnergy(user) {
  const now = Date.now();
  const elapsedSec = (now - user.lastEnergyUpdate) / 1000;
  const regenerated = elapsedSec * ENERGY_REGEN_PER_SEC;
  user.energy = Math.min(MAX_ENERGY, user.energy + regenerated);
  user.lastEnergyUpdate = now;
}

// ---- Rotte API ----

// Autenticazione + recupero profilo
app.post('/api/auth', (req, res) => {
  const { initData } = req.body;
  const tgUser = validateInitData(initData);
  if (!tgUser) return res.status(401).json({ error: 'initData non valido' });

  const db = loadDB();
  const user = getOrCreateUser(db, tgUser);
  refreshEnergy(user);
  saveDB(db);

  res.json({
    id: user.id,
    username: user.username,
    score: Math.floor(user.score),
    energy: Math.floor(user.energy),
    maxEnergy: MAX_ENERGY,
    referralCode: user.referralCode,
  });
});

// Registra i tap (batch, inviati dal client ogni tot millisecondi)
app.post('/api/tap', (req, res) => {
  const { initData, taps } = req.body;
  const tgUser = validateInitData(initData);
  if (!tgUser) return res.status(401).json({ error: 'initData non valido' });

  const tapCount = Math.max(0, Math.min(MAX_TAPS_PER_REQUEST, parseInt(taps, 10) || 0));

  const db = loadDB();
  const user = getOrCreateUser(db, tgUser);
  refreshEnergy(user);

  // Il server, non il client, decide quanti punti assegnare: consuma energia disponibile.
  const consumed = Math.min(tapCount, Math.floor(user.energy));
  user.energy -= consumed;
  user.score += consumed;

  saveDB(db);

  res.json({
    score: Math.floor(user.score),
    energy: Math.floor(user.energy),
    accepted: consumed,
  });
});

// Claim referral: chiamato quando un nuovo utente apre l'app con ?startapp=ref_<id>
app.post('/api/referral/claim', (req, res) => {
  const { initData, refCode } = req.body;
  const tgUser = validateInitData(initData);
  if (!tgUser) return res.status(401).json({ error: 'initData non valido' });

  const db = loadDB();
  const user = getOrCreateUser(db, tgUser);

  if (user.referralClaimed) {
    return res.status(400).json({ error: 'Referral già riscattato' });
  }
  if (!refCode || refCode === user.id) {
    return res.status(400).json({ error: 'Codice referral non valido' });
  }
  const referrer = db.users[refCode];
  if (!referrer) {
    return res.status(404).json({ error: 'Referral inesistente' });
  }

  user.referredBy = refCode;
  user.referralClaimed = true;
  user.score += REFERRAL_BONUS;
  referrer.score += REFERRAL_BONUS;

  saveDB(db);
  res.json({ score: Math.floor(user.score), bonus: REFERRAL_BONUS });
});

// Leaderboard pubblica (top 20)
app.get('/api/leaderboard', (req, res) => {
  const db = loadDB();
  const top = Object.values(db.users)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((u) => ({ username: u.username, score: Math.floor(u.score) }));
  res.json(top);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server avviato su porta ${PORT}`);
});
