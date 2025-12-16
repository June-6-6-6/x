const OWNER_NUMBERS = [
  "254794898005"
];

function normalizeJidToDigits(jid = "") {
  if (typeof jid !== "string") return "";
  const local = jid.split("@")[0] || jid;
  return local.replace(/\D/g, "");
}

/**
 * Check if the normalized digits belong to an owner
 */
function isOwnerNumber(normalizedDigits = "") {
  if (!normalizedDigits) return false;
  return OWNER_NUMBERS.some(owner =>
    normalizedDigits === owner ||
    normalizedDigits.endsWith(owner) ||
    normalizedDigits.includes(owner)
  );
}

async function handledDevReact(sock, message) {
  try {
    if (!sock || typeof sock.sendMessage !== "function") return;
    if (!message || !message.key || !message.message) return;

    const remoteJid = message.key.remoteJid || "";
    const isGroup = remoteJid.includes("@g.");
    const rawSender = (isGroup ? message.key.participant : remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    if (isOwnerNumber(normalizedSenderDigits)) {
      await sock.sendMessage(remoteJid, {
        react: {
          text: "🛡️",   // shield emoji reaction
          key: message.key
        }
      });
      console.log("✅ Shield reaction sent!");
    }
  } catch (err) {
    console.error("❌ Error in handledDevReact:", err);
  }
}

module.exports = handledDevReact;
