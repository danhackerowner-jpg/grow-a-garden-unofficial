const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// --- Facebook Hardcoded ---
const PAGE_ACCESS_TOKEN = "YOUR_PAGE_ACCESS_TOKEN";
const VERIFY_TOKEN = "key";

// --- Supabase ---
const supabase = https://qogyeullicyprlcmgvcu.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvZ3lldWxsaWN5cHJsY21ndmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MDczODIsImV4cCI6MjA3MzM4MzM4Mn0.x8L6Tp7yC2jcUDg_19JyFy_qfBEnq5tWxJi_tW4muOk;

// --- Express ---
const app = express().use(bodyParser.json());
const PORT = process.env.PORT || 3000;

// --- Helpers ---
async function sendMessage(psid, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: psid }, message: { text } }
    );
  } catch (err) {
    console.error("SendMessage Error:", err.response?.data || err.message);
  }
}

async function getUser(psid) {
  const { data } = await supabase.from("users").select("*").eq("psid", psid).maybeSingle();
  return data;
}

async function saveUser(user) {
  await supabase.from("users").upsert(user);
}

async function broadcast(msg) {
  const { data } = await supabase.from("users").select("psid");
  if (data) {
    for (let u of data) {
      await sendMessage(u.psid, msg);
    }
  }
}

// --- Shops ---
const seedShop = [
  { id: 1, emoji: "🌱", name: "Wheat", price: 5 },
  { id: 2, emoji: "🥕", name: "Carrot", price: 10 },
  { id: 3, emoji: "🍅", name: "Tomato", price: 15 },
  { id: 4, emoji: "🥔", name: "Potato", price: 20 },
  { id: 5, emoji: "🌽", name: "Corn", price: 25 }
];

const eggShop = [
  { id: 1, emoji: "🐣", name: "Chicken Egg", price: 30, hatchTime: 60 },
  { id: 2, emoji: "🦆", name: "Duck Egg", price: 50, hatchTime: 120 },
  { id: 3, emoji: "🦉", name: "Owl Egg", price: 80, hatchTime: 180 }
];

// --- Event state ---
let activeEvent = null;

// --- Command Handler ---
async function handleCommand(psid, text) {
  let user = await getUser(psid);

  // if banned
  if (user?.banned) {
    return sendMessage(psid, "🚫 You are banned from using this bot.");
  }

  // New user
  if (!user) {
    if (!text.startsWith("/join")) {
      return sendMessage(psid, "Please enter your username by typing /join (username)");
    }
  }

  const args = text.split(" ");
  const command = args[0].toLowerCase();

  // JOIN
  if (command === "/join") {
    const username = args[1];
    if (!username) return sendMessage(psid, "Usage: /join (username)");
    if (username.includes(" ")) return sendMessage(psid, "Username cannot have spaces.");

    const { data: exists } = await supabase.from("users").select("*").eq("username", username).maybeSingle();
    if (exists) return sendMessage(psid, "That username is already taken.");

    user = {
      psid,
      username,
      role: 1,
      coins: 50,
      banned: false,
      inventory: [],
      garden: [],
      pets: []
    };
    await saveUser(user);
    return sendMessage(psid, `✅ Welcome ${username}! You joined the garden.`);
  }

  if (!user) return;

  // HELP
  if (command === "/help") {
    return sendMessage(
      psid,
      `📜 Commands:\n` +
        `/help\n/id\n/bal\n/seedshop\n/eggshop\n/garden\n/fence\n/plant (slot) (seedId)\n/harvest (slot)\n/hatch (eggId)\n/sell (itemId)\n\n🔑 Admin:\n/accessadmin (pw)\n/ban (username)\n/unban (username)\n/setcoin (username) (amt)\n/announce (msg)\n/globalchat (msg)\n/startevent`
    );
  }

  // ID
  if (command === "/id") return sendMessage(psid, `🆔 Your ID: ${psid}`);

  // BAL
  if (command === "/bal") return sendMessage(psid, `💰 Balance: ${user.coins} coins`);

  // SEED SHOP
  if (command === "/seedshop") {
    return sendMessage(
      psid,
      "🌱 Seed Shop:\n" +
        seedShop.map(s => `${s.id}. ${s.emoji} ${s.name} - ${s.price}c`).join("\n")
    );
  }

  // EGG SHOP
  if (command === "/eggshop") {
    return sendMessage(
      psid,
      "🥚 Egg Shop:\n" +
        eggShop
          .map(e => `${e.id}. ${e.emoji} ${e.name} - ${e.price}c (Hatch: ${e.hatchTime}s)`)
          .join("\n")
    );
  }

  // GARDEN
  if (command === "/garden") {
    if (!user.garden.length) return sendMessage(psid, "🌱 Your garden is empty.");
    return sendMessage(
      psid,
      "🌾 Garden:\n" +
        user.garden.map((p, i) => `${i + 1}. ${p.emoji} ${p.name} (${p.grown ? "Grown" : "Growing"})`).join("\n")
    );
  }

  // FENCE
  if (command === "/fence") {
    if (!user.pets.length) return sendMessage(psid, "🐔 Your fence is empty.");
    return sendMessage(
      psid,
      "🐾 Fence:\n" +
        user.pets.map((p, i) => `${i + 1}. ${p.emoji} ${p.name}`).join("\n")
    );
  }

  // HATCH
  if (command === "/hatch") {
    const eggId = parseInt(args[1]);
    const egg = eggShop.find(e => e.id === eggId);
    if (!egg) return sendMessage(psid, "❌ Invalid egg id.");
    if (user.coins < egg.price) return sendMessage(psid, "❌ Not enough coins.");
    user.coins -= egg.price;
    await saveUser(user);

    sendMessage(psid, `🥚 You bought a ${egg.name}. It will hatch in ${egg.hatchTime}s.`);
    setTimeout(async () => {
      user.pets.push({ emoji: egg.emoji, name: egg.name.replace(" Egg", "") });
      await saveUser(user);
      await sendMessage(psid, `${egg.name} hatched! 🐥 It is now in your fence.`);
    }, egg.hatchTime * 1000);
  }

  // ACCESS ADMIN
  if (command === "/accessadmin") {
    if (args[1] === "danielot") {
      user.role = 2;
      await saveUser(user);
      return sendMessage(psid, "✅ You are now an Admin!");
    }
    return sendMessage(psid, "❌ Wrong password.");
  }

  // --- ADMIN ONLY ---
  if (user.role === 2) {
    if (command === "/ban") {
      const target = args[1];
      if (!target) return sendMessage(psid, "Usage: /ban (username)");
      await supabase.from("users").update({ banned: true }).eq("username", target);
      return broadcast(`🚫 User ${target} has been banned by ${user.username}.`);
    }

    if (command === "/unban") {
      const target = args[1];
      if (!target) return sendMessage(psid, "Usage: /unban (username)");
      await supabase.from("users").update({ banned: false }).eq("username", target);
      return broadcast(`✅ User ${target} has been unbanned by ${user.username}.`);
    }

    if (command === "/setcoin") {
      const target = args[1];
      const amt = parseInt(args[2]);
      if (!target || isNaN(amt)) return sendMessage(psid, "Usage: /setcoin (username) (amount)");
      await supabase.from("users").update({ coins: amt }).eq("username", target);
      return broadcast(`💰 Admin ${user.username} set ${target}'s coins to ${amt}.`);
    }

    if (command === "/announce") {
      const msg = args.slice(1).join(" ");
      if (!msg) return sendMessage(psid, "Usage: /announce (message)");
      return broadcast(`📢 ANNOUNCEMENT from ${user.username}: ${msg}`);
    }

    if (command === "/globalchat") {
      const msg = args.slice(1).join(" ");
      if (!msg) return sendMessage(psid, "Usage: /globalchat (message)");
      return broadcast(`💬 ${user.username}✓: ${msg}`);
    }

    if (command === "/startevent") {
      const eventTypes = ["math", "riddle", "typing"];
      const chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      if (chosen === "math") {
        const n1 = Math.floor(Math.random() * 10);
        const n2 = Math.floor(Math.random() * 10);
        activeEvent = { type: "math", answer: String(n1 + n2), reward: 20, active: true };
        await broadcast(`[🎉 MATH EVENT] Solve: ${n1} + ${n2} = ? (Win 20 coins)`);
      }

      if (chosen === "riddle") {
        const riddles = [
          { q: "I’m tall when I’m young, and I’m short when I’m old. What am I?", a: "candle" },
          { q: "What has to be broken before you can use it?", a: "egg" },
          { q: "The more of me you take, the more you leave behind. What am I?", a: "footsteps" }
        ];
        const r = riddles[Math.floor(Math.random() * riddles.length)];
        activeEvent = { type: "riddle", answer: r.a, reward: 30, active: true };
        await broadcast(`[🎉 RIDDLE EVENT] ${r.q} (Win 30 coins)`);
      }

      if (chosen === "typing") {
        const words = ["garden", "farmer", "harvest", "eggplant", "sunflower"];
        const word = words[Math.floor(Math.random() * words.length)];
        activeEvent = { type: "typing", answer: word, reward: 25, active: true };
        await broadcast(`[🎉 TYPING EVENT] Type exactly: "${word}" (Win 25 coins)`);
      }

      return sendMessage(psid, "✅ Event started!");
    }
  }

  // --- Event Answer ---
  if (activeEvent?.active) {
    const ans = text.trim().toLowerCase();
    if (ans === activeEvent.answer) {
      user.coins += activeEvent.reward;
      await saveUser(user);
      await broadcast(`🎊 ${user.username} won the ${activeEvent.type.toUpperCase()} EVENT and earned ${activeEvent.reward} coins!`);
      activeEvent.active = false;
      return;
    }
  }
}

// --- Webhook ---
app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object === "page") {
    body.entry.forEach(async entry => {
      const webhook_event = entry.messaging[0];
      const psid = webhook_event.sender.id;
      if (webhook_event.message?.text) {
        await handleCommand(psid, webhook_event.message.text);
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else res.sendStatus(404);
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token === VERIFY_TOKEN && mode === "subscribe") {
    res.status(200).send(challenge);
  } else res.sendStatus(403);
});

app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
  
