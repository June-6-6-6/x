// devReact.js

const OWNER_NUMBERS = [
  "254794898005"
];

const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid || typeof jid !== "string") {
    return "";
  }
  const local = jid.split("@")[0] || jid;
  const digits = local.replace(/\D/g, "");
  return digits;
}

function isOwnerNumber(normalizedDigits) {
  if (!normalizedDigits) {
    return false;
  }
  for (const owner of OWNER_NUMBERS) {
    if (normalizedDigits === owner) {
      return true;
    }
    if (normalizedDigits.endsWith(owner)) {
      return true;
    }
    if (normalizedDigits.includes(owner)) {
      return true;
    }
  }
  return false;
}

async function handleDevReact(sock, message) {
  try {
    if (!message || !message.key) {
      return;
    }
    if (!message.message) {
      return;
    }

    const remoteJid = message.key.remoteJid || "";
    const isGroup = typeof remoteJid === "string" && remoteJid.includes("@g.");
    const rawSender = (isGroup ? message.key.participant : message.key.remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    if (isOwnerNumber(normalizedSenderDigits)) {
      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: message.key
        }
      });
    }
  } catch (err) {
    console.error("Error in handleDevReact:", err);
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
