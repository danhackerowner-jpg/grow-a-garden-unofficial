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

  if (!user) return;

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

  if (command === "/accessadmin") {
    if (args[1] === "danielot") {
      user.role = 2;
      await saveUser(user);
      return sendMessage(psid, "✅ You are now an Admin!");
    }
    return sendMessage(psid, "❌ Wrong password.");
  }

  // Example Admin Command
  if (user.role === 2 && command === "/announce") {
    const msg = args.slice(1).join(" ");
    if (!msg) return sendMessage(psid, "Usage: /announce (message)");
    return broadcast(`📢 ANNOUNCEMENT from ${user.username}: ${msg}`);
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
    
