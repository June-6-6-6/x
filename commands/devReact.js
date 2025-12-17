const OWNER_NUMBERS = ["254794898005"];
const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid || typeof jid !== "string") return "";
  const local = jid.split("@")[0] || jid;
  return local.replace(/\D/g, "");
}

function isOwnerNumber(normalizedDigits) {
  if (!normalizedDigits) return false;
  return OWNER_NUMBERS.includes(normalizedDigits);
}

async function handleDevReact(sock, message) {
  try {
    if (!message || !message.key || !message.message) return;

    const remoteJid = message.key.remoteJid || "";
    const isGroup = remoteJid.includes("@g.");
    const rawSender = (isGroup ? message.key.participant : remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    if (isOwnerNumber(normalizedSenderDigits)) {
      await sock.sendMessage(remoteJid, {
        react: { text: EMOJI, key: message.key }
      });
    }
  } catch (err) {
    // Silent error handling
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
