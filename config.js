// ============================================================
// CONFIG.JS — Unica fonte di verità per tutte le impostazioni.
// Il server la legge per applicare le regole (anti-cheat vero).
// Il frontend la riceve da /api/config, così non c'è mai
// disallineamento tra quello che vedi e quello che il server
// applica davvero.
// ============================================================

module.exports = {
  // --- Identità del progetto ---
  tokenName: "FROG",
  tokenFullName: "FrogCoin",
  botUsername: "frogstein_bot",
  miniAppShortName: "frogstein",

  // --- Tap-to-earn ---
  tap: {
    rewardPerTap: 1.5,      // punti guadagnati per ogni tap
    maxTapsPerDay: 500,     // limite giornaliero (si resetta a mezzanotte UTC)
  },

  // --- Mining passivo ---
  farming: {
    durationHours: 8,
    rewardPerCycle: 500,
  },

  // --- Referral ---
  referral: {
    bonusPercent: 10, // % di ogni guadagno futuro dell'amico invitato
    inviteMessage: "🐸 Unisciti a Tap Coin e guadagna $FROG prima del lancio!",
  },

  // --- Daily check-in ---
  dailyCheckin: {
    rewards: [100, 200, 300, 400, 500, 600, "mystery"],
    mysteryBoxMin: 700,
    mysteryBoxMax: 1500,
  },

  // --- Airdrop ---
  airdrop: {
    // Formato ISO, orario UTC. Cambia solo questa riga per spostare la data.
    deadlineISO: "2027-01-01T00:00:00Z",
    title: "$FROG Airdrop",
    subtitle: "Le monete accumulate ora determinano la tua quota finale",
  },

  // --- Task / missioni ---
  tasks: [
    {
      id: "join_channel",
      category: "Social",
      icon: "📣",
      title: "Unisciti al canale Telegram",
      reward: 250,
      url: "https://t.me/tuocanale",
      verifySeconds: 5,
    },
    {
      id: "follow_x",
      category: "Social",
      icon: "🐦",
      title: "Segui su X",
      reward: 200,
      url: "https://x.com/tuoaccount",
      verifySeconds: 5,
    },
    {
      id: "academy_1",
      category: "Academy",
      icon: "🎓",
      title: "Cos'è un airdrop?",
      reward: 150,
      url: "https://t.me/tuocanale",
      verifySeconds: 5,
    },
    {
      id: "partner_1",
      category: "Partners",
      icon: "🤝",
      title: "Scopri il progetto partner",
      reward: 300,
      url: "https://example.com",
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
