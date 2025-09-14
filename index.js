const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// --- Facebook Hardcoded ---
const PAGE_ACCESS_TOKEN = "EAANWqh0HAoMBPadfArroTb09GmkDJQcUITZCMAOXx2Gb1CRPEPVFEg2qJSfieOkWmdGuM4SQkbPmNDpWvLjdecGEUHtZBCfT0mhb23RHsZC0XVSYkOnN0BDseGmAymPqL3zEJDFe3ZCMQAhzXCFNnNSGOMZAMbG9E1ZANjLqHHqeSV7IVy2zeOqMIfCS7ZBImOzuekCZAPpgkwZDZD";
const VERIFY_TOKEN = "key";

// --- Supabase Hardcoded ---
const SUPABASE_URL = "https://qogyeullicyprlcmgvcu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvZ3lldWxsaWN5cHJsY21ndmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MDczODIsImV4cCI6MjA3MzM4MzM4Mn0.x8L6Tp7yC2jcUDg_19JyFy_qfBEnq5tWxJi_tW4muOk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Data Shops ---
const SEEDS = [
  { id: 1, name: "🌽 Corn", price: 10, growTime: 30 },
  { id: 2, name: "🍎 Apple", price: 20, growTime: 60 },
  { id: 3, name: "🍇 Grape", price: 30, growTime: 120 },
  { id: 4, name: "🥕 Carrot", price: 15, growTime: 45 },
  { id: 5, name: "🍉 Watermelon", price: 50, growTime: 180 }
];

const EGGS = [
  { id: 1, name: "🥚 Chicken Egg", price: 50, hatchTime: 60, pet: "🐔 Chicken" },
  { id: 2, name: "🦆 Duck Egg", price: 80, hatchTime: 90, pet: "🦆 Duck" },
  { id: 3, name: "🦉 Owl Egg", price: 120, hatchTime: 120, pet: "🦉 Owl" }
];

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
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("psid", psid)
    .maybeSingle();
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

// --- Command Handler ---
async function handleCommand(psid, text) {
  let user = await getUser(psid);

  // Require /join if user doesn't exist
  if (!user) {
    if (!text.startsWith("/join")) {
      return sendMessage(
        psid,
        "🌱 Please enter your username by typing /join (username)"
      );
    }
  }

  const args = text.split(" ");
  const command = args[0].toLowerCase();

  // --- Join command ---
  if (command === "/join") {
    const username = args[1];
    if (!username) return sendMessage(psid, "Usage: /join (username)");
    if (username.includes(" "))
      return sendMessage(psid, "❌ Username cannot have spaces.");

    const { data: exists } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (exists) return sendMessage(psid, "❌ That username is already taken.");

    user = {
      psid,
      username,
      role: 1,
      coins: 50,
      banned: false,
      inventory: [],
      garden: [],
      pets: [],
    };

    await saveUser(user);

    return sendMessage(
      psid,
      `✅ Welcome ${username}! You can now use commands like /help`
    );
  }

  // If still no user, block other commands
  if (!user) return;

  // --- Basic Commands ---
  if (command === "/help") {
    return sendMessage(
      psid,
      "📜 Commands:\n/help\n/id\n/bal\n/seedshop\n/eggshop\n/garden\n/fence\n/plant (num)\n/harvest (num)\n/hatch (num)\n/sell (num)\n\n🔑 Admin:\n/accessadmin (pw)\n/ban (username)\n/unban (username)\n/setcoin (username amount)\n/announce (msg)\n/globalchat (msg)\n/startevent"
    );
  }

  if (command === "/id")
    return sendMessage(psid, `🆔 Your ID: ${psid}`);

  if (command === "/bal")
    return sendMessage(psid, `💰 Balance: ${user.coins} coins`);

  if (command === "/seedshop") {
    let msg = "🌱 Seed Shop:\n";
    SEEDS.forEach(s => {
      msg += `${s.id}. ${s.name} - ${s.price} coins\n`;
    });
    return sendMessage(psid, msg);
  }

  if (command === "/eggshop") {
    let msg = "🥚 Egg Shop:\n";
    EGGS.forEach(e => {
      msg += `${e.id}. ${e.name} - ${e.price} coins\n`;
    });
    return sendMessage(psid, msg);
  }

  if (command === "/garden") {
    if (!user.garden.length) return sendMessage(psid, "🌱 Your garden is empty.");
    let msg = "🌿 Your Garden:\n";
    user.garden.forEach((g, i) => {
      msg += `${i + 1}. ${g.name} - ${g.progress}% grown\n`;
    });
    return sendMessage(psid, msg);
  }

  if (command === "/fence") {
    if (!user.pets.length) return sendMessage(psid, "🐾 No pets yet.");
    let msg = "🐔 Your Pets:\n";
    user.pets.forEach((p, i) => {
      msg += `${i + 1}. ${p}\n`;
    });
    return sendMessage(psid, msg);
  }

  // Plant seed
  if (command === "/plant") {
    const num = parseInt(args[1]);
    const seed = SEEDS.find(s => s.id === num);
    if (!seed) return sendMessage(psid, "❌ Invalid seed number.");
    if (user.coins < seed.price) return sendMessage(psid, "❌ Not enough coins.");
    user.coins -= seed.price;
    user.garden.push({ name: seed.name, progress: 0, growTime: seed.growTime });
    await saveUser(user);
    return sendMessage(psid, `🌱 You planted ${seed.name}!`);
  }

  // Harvest
  if (command === "/harvest") {
    const num = parseInt(args[1]) - 1;
    if (!user.garden[num]) return sendMessage(psid, "❌ Invalid slot.");
    if (user.garden[num].progress < 100)
      return sendMessage(psid, "⏳ Plant not ready yet.");
    user.coins += 20;
    user.garden.splice(num, 1);
    await saveUser(user);
    return sendMessage(psid, "✅ Harvested and earned 20 coins!");
  }

  // Hatch egg
  if (command === "/hatch") {
    const num = parseInt(args[1]);
    const egg = EGGS.find(e => e.id === num);
    if (!egg) return sendMessage(psid, "❌ Invalid egg number.");
    if (user.coins < egg.price) return sendMessage(psid, "❌ Not enough coins.");
    user.coins -= egg.price;
    user.pets.push(egg.pet);
    await saveUser(user);
    return sendMessage(psid, `🐣 Your ${egg.name} hatched into ${egg.pet}!`);
  }

  // Sell
  if (command === "/sell") {
    if (!user.garden.length && !user.pets.length)
      return sendMessage(psid, "❌ Nothing to sell.");
    user.coins += 30;
    user.garden = [];
    user.pets = [];
    await saveUser(user);
    return sendMessage(psid, "✅ Sold everything for 30 coins!");
  }

  // --- Admin Commands ---
  if (command === "/accessadmin") {
    if (args[1] === "danielot") {
      user.role = 2;
      await saveUser(user);
      return sendMessage(psid, "✅ You are now an Admin!");
    }
    return sendMessage(psid, "❌ Wrong password.");
  }

  if (user.role === 2 && command === "/announce") {
    const msg = args.slice(1).join(" ");
    if (!msg) return sendMessage(psid, "Usage: /announce (message)");
    return broadcast(`📢 ANNOUNCEMENT from ${user.username}: ${msg}`);
  }

  if (user.role === 2 && command === "/globalchat") {
    const msg = args.slice(1).join(" ");
    return broadcast(`(${user.username})✓: ${msg}`);
  }
}

// --- Webhook ---
app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object === "page") {
    body.entry.forEach(async (entry) => {
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
   
