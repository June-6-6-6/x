// devReact.js

const OWNER_NUMBERS = [
  "254794898005"
];

const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid || typeof jid !== "string") {
    console.log("Invalid jid:", jid);
    return "";
  }
  const local = jid.split("@")[0] || jid;
  const digits = local.replace(/\D/g, "");
  console.log("normalizeJidToDigits:", digits);
  return digits;
}

function isOwnerNumber(normalizedDigits) {
  if (!normalizedDigits) {
    console.log("Empty normalizedDigits");
    return false;
  }
  for (const owner of OWNER_NUMBERS) {
    if (normalizedDigits === owner) {
      console.log("Owner match:", normalizedDigits);
      return true;
    }
    if (normalizedDigits.endsWith(owner)) {
      console.log("Owner match (endsWith):", normalizedDigits);
      return true;
    }
    if (normalizedDigits.includes(owner)) {
      console.log("Owner match (includes):", normalizedDigits);
      return true;
    }
  }
  console.log("No owner match:", normalizedDigits);
  return false;
}

async function handleDevReact(sock, message) {
  try {
    if (!message || !message.key) {
      console.log("Missing message or key");
      return;
    }
    if (!message.message) {
      console.log("No message content");
      return;
    }

    const remoteJid = message.key.remoteJid || "";
    const isGroup = typeof remoteJid === "string" && remoteJid.includes("@g.");
    const rawSender = (isGroup ? message.key.participant : message.key.remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    console.log("remoteJid:", remoteJid);
    console.log("rawSender:", rawSender);
    console.log("normalizedSenderDigits:", normalizedSenderDigits);

    if (isOwnerNumber(normalizedSenderDigits)) {
      console.log("Owner detected, sending reaction...");
      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: message.key
        }
      });
      console.log("Reaction sent");
    } else {
      console.log("Not owner, no reaction");
    }
  } catch (err) {
    console.error("Error in handleDevReact:", err);
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
