const OWNER_NUMBERS = [
  "254794898005" // bare digits only
];

const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid || typeof jid !== "string") return "";
  const local = jid.split("@")[0] || jid;
  return local.replace(/\D/g, "");
}

// Strict check: only exact matches allowed
function isOwnerNumber(normalizedDigits) {
  if (!normalizedDigits) return false;
  return OWNER_NUMBERS.includes(normalizedDigits);
}

async function handleDevReact(sock, message) {
  try {
    if (!message || !message.key || !message.message) {
      return;
    }

    const remoteJid = message.key.remoteJid || "";
    const isGroup = typeof remoteJid === "string" && remoteJid.includes("@g.");

    // Sender in group is message.key.participant, in private it's remoteJid
    const rawSender = (isGroup ? message.key.participant : message.key.remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    if (isOwnerNumber(normalizedSenderDigits)) {
      console.log(`👑 Owner ${normalizedSenderDigits} detected — sending reaction...`);

      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: message.key
        }
      });

      console.log("✅ Reaction sent!");
    }
  } catch (err) {
    console.error("❌ Error in handleDevReact:", err);
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
