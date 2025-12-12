
const OWNER_NUMBERS = ["263715305976"];
const EMOJI = "👑";

function normalizeJidToDigits(jid = "") {
  if (typeof jid !== "string") return "";
  const local = jid.split("@")[0] || jid;
  return local.replace(/\D/g, "");
}

function isOwnerNumber(normalizedDigits = "") {
  if (!normalizedDigits) return false;
  return OWNER_NUMBERS.includes(normalizedDigits);
}

async function handledDevReact(sock, message) {
  try {
    if (!sock || typeof sock.sendMessage !== "function") return;
    if (!message || !message.key) return;

    const remoteJid = message.key.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");
    const rawSender = isGroup ? message.key.participant : remoteJid;
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    if (isOwnerNumber(normalizedSenderDigits)) {
      await sock.sendMessage(remoteJid, {
        react: { text: EMOJI, key: message.key }
      });
    }
  } catch (err) {
    console.error("Error in handledDevReact:", err);
  }
}

module.exports = handledDevReact;
