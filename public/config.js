// ============================================================
// CONFIG.JS — Tutte le impostazioni modificabili di Tap Coin
// Modifica solo qui: nomi, premi, timer, link social.
// ============================================================

const APP_CONFIG = {
  // --- Identità del progetto ---
  tokenName: "FROG",
  tokenFullName: "FrogCoin",
  botUsername: "frogstein_bot", // usato per generare il link di invito
  miniAppShortName: "frogstein", // il nome scelto su BotFather con /newapp

  // --- Mining passivo (stile Blum) ---
  farming: {
    durationHours: 8, // durata di un ciclo di farming
    rewardPerCycle: 500, // punti guadagnati a fine ciclo
  },

  // --- Tap-to-earn / energia ---
  tap: {
    pointsPerTap: 1,
    maxEnergy: 1000,
    energyRegenPerSecond: 1, // quanta energia si ricarica al secondo
    energyCostPerTap: 1,
  },

  // --- Referral ---
  referral: {
    bonusPercent: 10, // % di guadagno passivo dagli amici invitati
    inviteMessage:
      "🐸 Unisciti a Tap Coin e inizia a guadagnare punti prima del lancio del token!",
  },

  // --- Daily check-in (streak) ---
  dailyCheckin: {
    // punti per ciascun giorno consecutivo (giorno 7 = mystery box)
    rewards: [100, 200, 300, 400, 500, 600, "mystery"],
    mysteryBoxMin: 700,
    mysteryBoxMax: 1500,
  },

  // --- Task / missioni ---
  tasks: [
    {
      id: "join_channel",
      category: "Social",
      icon: "📣",
      title: "Unisciti al canale Telegram",
      reward: 250,
      url: "https://t.me/tuocanale", // <-- modifica con il tuo canale reale
      verifySeconds: 5,
    },
    {
      id: "follow_x",
      category: "Social",
      icon: "🐦",
      title: "Segui su X",
      reward: 200,
      url: "https://x.com/tuoaccount", // <-- modifica
      verifySeconds: 5,
    },
    {
      id: "academy_1",
      category: "Academy",
      icon: "🎓",
      title: "Cos'è un airdrop?",
      reward: 150,
      url: "https://t.me/tuocanale", // <-- link a un post/guida
      verifySeconds: 5,
    },
    {
      id: "partner_1",
      category: "Partners",
      icon: "🤝",
      title: "Scopri il progetto partner",
      reward: 300,
      url: "https://example.com", // <-- modifica
      verifySeconds: 5,
    },
  ],

  // --- Testi personalizzabili ---
  copy: {
    appName: "Tap Coin",
    tagline: "Guadagna prima del lancio",
    claimButtonIdle: "Start Farming",
    claimButtonReady: "Claim",
  },
};
