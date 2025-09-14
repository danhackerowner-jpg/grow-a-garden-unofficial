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

// --- Command Handler ---
async function handleCommand(psid, text) {
  let user = await getUser(psid);
  const args = text.trim().split(" ");
  const command = args[0]?.toLowerCase();

  // Force join first
  if (!user) {
    if (command !== "/join") {
      return sendMessage(psid, "❌ You must join first. Use: /join <username>");
    }
  }

  // --- Join Command ---
  if (command === "/join") {
    const username = args[1];
    if (!username) return sendMessage(psid, "Usage: /join <username>");
    if (username.includes(" "))
      return sendMessage(psid, "❌ Username cannot contain spaces.");

    const { data: exists } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (exists) return sendMessage(psid, "⚠️ That username is already taken.");

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
    return sendMessage(psid, `✅ Welcome ${username}! You joined the garden.`);
  }

  if (!user) return; // safety

  // --- Normal Commands ---
  if (command === "/help") {
    return sendMessage(
      psid,
      `📜 Commands:
      /help - Show this list
      /id - Show your PSID
      /bal - Show your coin balance
      /seedshop - View seeds available
      /eggshop - View eggs available
      /garden - View your planted seeds
      /fence - View your pets
      /plant <seed> - Plant a seed
      /harvest <seed> - Harvest crops
      /hatch <egg> - Hatch an egg
      /sell <item> - Sell crops/pets

🔑 Admin:
      /accessadmin <pw>
      /ban <username>
      /unban <username>
      /setcoin <username> <amount>
      /announce <msg>
      /globalchat <msg>
      /startevent <eventname>`
    );
  }

  if (command === "/id")
    return sendMessage(psid, `🆔 Your ID: ${psid}`);

  if (command === "/bal")
    return sendMessage(psid, `💰 Balance: ${user.coins} coins`);

  if (command === "/seedshop") {
    return sendMessage(
      psid,
      "🌱 Seed Shop:\n- Apple Seed (10c)\n- Banana Seed (15c)\n- Carrot Seed (20c)\n- Mango Seed (25c)\n- Strawberry Seed (30c)"
    );
  }

  if (command === "/eggshop") {
    return sendMessage(
      psid,
      "🥚 Egg Shop:\n- Chicken Egg (50c)\n- Duck Egg (75c)\n- Dragon Egg (200c)"
    );
  }

  if (command === "/garden") {
    return sendMessage(
      psid,
      user.garden.length > 0
        ? `🌱 Your Garden: ${user.garden.join(", ")}`
        : "🌱 Your garden is empty."
    );
  }

  if (command === "/fence") {
    return sendMessage(
      psid,
      user.pets.length > 0
        ? `🐾 Your Fence: ${user.pets.join(", ")}`
        : "🐾 Your fence has no pets."
    );
  }

  if (command === "/plant") {
    const seed = args[1];
    if (!seed) return sendMessage(psid, "Usage: /plant <seed>");
    user.garden.push(seed);
    await saveUser(user);
    return sendMessage(psid, `🌱 You planted a ${seed}.`);
  }

  if (command === "/harvest") {
    const seed = args[1];
    if (!seed) return sendMessage(psid, "Usage: /harvest <seed>");
    if (!user.garden.includes(seed))
      return sendMessage(psid, `❌ You don’t have ${seed} planted.`);
    user.garden = user.garden.filter((s) => s !== seed);
    user.inventory.push(`${seed} crop`);
    await saveUser(user);
    return sendMessage(psid, `✅ You harvested ${seed}.`);
  }

  if (command === "/hatch") {
    const egg = args[1];
    if (!egg) return sendMessage(psid, "Usage: /hatch <egg>");
    user.pets.push(`${egg} pet`);
    await saveUser(user);
    return sendMessage(psid, `🐣 Your ${egg} hatched into a pet!`);
  }

  if (command === "/sell") {
    const item = args.slice(1).join(" ");
    if (!item) return sendMessage(psid, "Usage: /sell <item>");
    if (!user.inventory.includes(item) && !user.pets.includes(item))
      return sendMessage(psid, `❌ You don’t have ${item}.`);

    user.inventory = user.inventory.filter((i) => i !== item);
    user.pets = user.pets.filter((i) => i !== item);
    user.coins += 20;
    await saveUser(user);
    return sendMessage(psid, `💰 You sold ${item} for 20 coins.`);
  }

  // --- Admin Access ---
  if (command === "/accessadmin") {
    if (args[1] === "danielot") {
      user.role = 2;
      await saveUser(user);
      return sendMessage(psid, "✅ You are now an Admin!");
    }
    return sendMessage(psid, "❌ Wrong password.");
  }

  // --- Admin Only Commands ---
  if (user.role === 2) {
    if (command === "/ban") {
      const target = args[1];
      if (!target) return sendMessage(psid, "Usage: /ban <username>");
      await supabase.from("users").update({ banned: true }).eq("username", target);
      return sendMessage(psid, `🚫 User ${target} has been banned.`);
    }

    if (command === "/unban") {
      const target = args[1];
      if (!target) return sendMessage(psid, "Usage: /unban <username>");
      await supabase.from("users").update({ banned: false }).eq("username", target);
      return sendMessage(psid, `✅ User ${target} has been unbanned.`);
    }

    if (command === "/setcoin") {
      const target = args[1];
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount))
        return sendMessage(psid, "Usage: /setcoin <username> <amount>");
      await supabase.from("users").update({ coins: amount }).eq("username", target);
      return sendMessage(psid, `💰 Set ${target}'s coins to ${amount}.`);
    }

    if (command === "/announce") {
      const msg = args.slice(1).join(" ");
      if (!msg) return sendMessage(psid, "Usage: /announce <message>");
      return broadcast(`📢 ANNOUNCEMENT from ${user.username}: ${msg}`);
    }

    if (command === "/globalchat") {
      const msg = args.slice(1).join(" ");
      if (!msg) return sendMessage(psid, "Usage: /globalchat <message>");
      return broadcast(`💬 ${user.username}: ${msg}`);
    }

    if (command === "/startevent") {
      const eventName = args[1];
      if (!eventName) return sendMessage(psid, "Usage: /startevent <event>");
      return broadcast(`🎉 Event started: ${eventName}!`);
    }
  }

  // --- Unknown Command ---
  return sendMessage(psid, "❓ Unknown command. Type /help for commands.");
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
  
