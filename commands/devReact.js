// devReact.js
// Reacts with 👑 only when an owner number sends a message.

const OWNER_NUMBERS = ["254794898005"]; // bare digits only
const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid) return "";
  return (jid.split("@")[0] || "").replace(/\D/g, "");
}

function isOwnerNumber(digits) {
  return digits && OWNER_NUMBERS.some(owner =>
    digits === owner || digits.endsWith(owner) || digits.includes(owner)
  );
}

async function handleDevReact(sock, msg) {
  try {
    if (!msg?.key || !msg.message) return;

    const remoteJid = msg.key.remoteJid || "";
    const isGroup = remoteJid.includes("@g.");
    const rawSender = isGroup ? msg.key.participant : remoteJid;
    const digits = normalizeJidToDigits(rawSender);

    if (isOwnerNumber(digits)) {
      await sock.sendMessage(remoteJid, {
        react: { text: EMOJI, key: msg.key }
      });
    }
  } catch (err) {
    console.error("Error in devReact:", err);
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
