// devReact.js

const OWNER_NUMBERS = [
  "254792021944"
];

const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid || typeof jid !== "string") {
    console.log("⚠️ normalizeJidToDigits: invalid jid", jid);
    return "";
  }
  const local = jid.split("@")[0] || jid;
  const digits = local.replace(/\D/g, "");
  console.log(`🔧 normalizeJidToDigits: input=${jid}, local=${local}, digits=${digits}`);
  return digits;
}

function isOwnerNumber(normalizedDigits) {
  if (!normalizedDigits) {
    console.log("⚠️ isOwnerNumber: empty normalizedDigits");
    return false;
  }
  for (const owner of OWNER_NUMBERS) {
    if (normalizedDigits === owner) {
      console.log(`✅ Exact owner match: ${normalizedDigits}`);
      return true;
    }
    if (normalizedDigits.endsWith(owner)) {
      console.log(`✅ EndsWith owner match: ${normalizedDigits}`);
      return true;
    }
    if (normalizedDigits.includes(owner)) {
      console.log(`✅ Includes owner match: ${normalizedDigits}`);
      return true;
    }
  }
  console.log(`❌ No owner match: ${normalizedDigits}`);
  return false;
}

async function handleDevReact(sock, message) {
  try {
    if (!message || !message.key) {
      console.log("⚠️ handleDevReact: missing message or key");
      return;
    }
    if (!message.message) {
      console.log("⚠️ handleDevReact: no message.message content");
      return;
    }

    const remoteJid = message.key.remoteJid || "";
    const isGroup = typeof remoteJid === "string" && remoteJid.includes("@g.");
    const rawSender = (isGroup ? message.key.participant : message.key.remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    console.log("📌 handleDevReact: remoteJid=", remoteJid);
    console.log("👥 handleDevReact: rawSender=", rawSender);
    console.log("🔎 handleDevReact: normalizedSenderDigits=", normalizedSenderDigits);
    console.log("👑 handleDevReact: OWNER_NUMBERS=", OWNER_NUMBERS);

    if (isOwnerNumber(normalizedSenderDigits)) {
      console.log("👑 Owner detected — sending reaction...");
      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: message.key
        }
      });
      console.log("✅ Reaction sent!");
    } else {
      console.log("❌ Not owner, no reaction sent.");
    }
  } catch (err) {
    console.error("❌ Error in handleDevReact:", err);
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
