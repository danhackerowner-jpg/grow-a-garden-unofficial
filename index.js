const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// --- Facebook Hardcoded ---
const PAGE_ACCESS_TOKEN = "EAANWqh0HAoMBPadfArroTb09GmkDJQcUITZCMAOXx2Gb1CRPEPVFEg2qJSfieOkWmdGuM4SQkbPmNDpWvLjdecGEUHtZBCfT0mhb23RHsZC0XVSYkOnN0BDseGmAymPqL3zEJDFe3ZCMQAhzXCFNnNSGOMZAMbG9E1ZANjLqHHqeSV7IVy2zeOqMIfCS7ZBImOzuekCZAPpgkwZDZD";
const VERIFY_TOKEN = "key";

// --- Supabase Hardcoded ---
const SUPABASE_URL = "https://qogyeullicyprlcmgvcu.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvZ3lldWxsaWN5cHJsY21ndmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MDczODIsImV4cCI6MjA3MzM4MzM4Mn0.x8L6Tp7yC2jcUDg_19JyFy_qfBEnq5tWxJi_tW4muOk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// --- Shops ---
const seeds = [
  { id: 1, emoji: "🌱", name: "Carrot", cost: 10, growTime: 1 },
  { id: 2, emoji: "🍎", name: "Apple", cost: 20, growTime: 2 },
  { id: 3, emoji: "🍇", name: "Grape", cost: 30, growTime: 3 },
  { id: 4, emoji: "🥔", name: "Potato", cost: 15, growTime: 2 },
];

const eggs = [
  { id: 1, emoji: "🥚", name: "Chicken Egg", cost: 50, hatchTime: 2 },
  { id: 2, emoji: "🦆", name: "Duck Egg", cost: 80, hatchTime: 3 },
  { id: 3, emoji: "🦉", name: "Owl Egg", cost: 100, hatchTime: 4 },
];

// --- Command Handler ---
async function handleCommand(psid, text) {
  let user = await getUser(psid);

  if (!user) {
    if (!text.startsWith("/join")) {
      return sendMessage(
        psid,
        "Please enter your username by typing /join (username)"
      );
    }
  }

  const args = text.split(" ");
  const command = args[0].toLowerCase();

  // --- JOIN ---
  if (command === "/join") {
    const username = args[1];
    if (!username) return sendMessage(psid, "Usage: /join (username)");
    if (username.includes(" "))
      return sendMessage(psid, "Username cannot have spaces.");

    const { data: exists } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (exists) return sendMessage(psid, "That username is already taken.");

    const newUser = {
      psid,
      username,
      role: 1,
      coins: 50,
      banned: false,
      inventory: [],
      garden: [],
      pets: [],
    };
    await saveUser(newUser);

    // ✅ Fix: set user in memory
    user = newUser;

    return sendMessage(psid, `✅ Welcome ${username}! You joined the garden.`);
  }

  if (!user) return;

  // --- USER COMMANDS ---
  if (command === "/help") {
    return sendMessage(
      psid,
      "📜 Commands:\n/help\n/id\n/bal\n/seedshop\n/eggshop\n/garden\n/fence\n/plant\n/harvest\n/hatch\n/sell\n\n🔑 Admin:\n/accessadmin (pw)\n/ban\n/unban\n/setcoin\n/announce\n/globalchat\n/startevent"
    );
  }

  if (command === "/id")
    return sendMessage(psid, `🆔 Your ID: ${psid}`);

  if (command === "/bal")
    return sendMessage(psid, `💰 Balance: ${user.coins} coins`);

  if (command === "/seedshop") {
    let msg = "🌱 Seed Shop:\n";
    for (let s of seeds) {
      msg += `${s.id}. ${s.emoji} ${s.name} - ${s.cost} coins\n`;
    }
    return sendMessage(psid, msg);
  }

  if (command === "/eggshop") {
    let msg = "🥚 Egg Shop:\n";
    for (let e of eggs) {
      msg += `${e.id}. ${e.emoji} ${e.name} - ${e.cost} coins\n`;
    }
    return sendMessage(psid, msg);
  }

  if (command === "/garden") {
    if (!user.garden.length) return sendMessage(psid, "🌱 Your garden is empty.");
    let msg = "🌱 Your Garden:\n";
    user.garden.forEach((p, i) => {
      msg += `${i + 1}. ${p.emoji} ${p.name} (Stage: ${p.stage}/${p.growTime})\n`;
    });
    return sendMessage(psid, msg);
  }

  if (command === "/fence") {
    if (!user.pets.length) return sendMessage(psid, "🐾 Your fence has no pets.");
    let msg = "🐾 Your Fence:\n";
    user.pets.forEach((p, i) => {
      msg += `${i + 1}. ${p.emoji} ${p.name} (Hatched)\n`;
    });
    return sendMessage(psid, msg);
  }

  // --- ADMIN ACCESS ---
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
    if (command === "/announce") {
      const msg = args.slice(1).join(" ");
      if (!msg) return sendMessage(psid, "Usage: /announce (message)");
      return broadcast(`📢 ANNOUNCEMENT from ${user.username}: ${msg}`);
    }

    if (command === "/ban") {
      const target = args[1];
      if (!target) return sendMessage(psid, "Usage: /ban (username)");
      await supabase.from("users").update({ banned: true }).eq("username", target);
      return sendMessage(psid, `🚫 Banned ${target}`);
    }

    if (command === "/unban") {
      const target = args[1];
      if (!target) return sendMessage(psid, "Usage: /unban (username)");
      await supabase.from("users").update({ banned: false }).eq("username", target);
      return sendMessage(psid, `✅ Unbanned ${target}`);
    }

    if (command === "/setcoin") {
      const target = args[1];
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount)) return sendMessage(psid, "Usage: /setcoin (username) (amount)");
      await supabase.from("users").update({ coins: amount }).eq("username", target);
      return sendMessage(psid, `💰 Set ${target}'s coins to ${amount}`);
    }

    if (command === "/globalchat") {
      const msg = args.slice(1).join(" ");
      if (!msg) return sendMessage(psid, "Usage: /globalchat (message)");
      return broadcast(`🌍 ${user.username}✓: ${msg}`);
    }

    if (command === "/startevent") {
      return broadcast("🎉 Event started! Answer quick questions to win coins soon!");
    }
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
    
