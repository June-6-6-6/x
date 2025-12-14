// devReact.js
// Reacts with 👑 only when the chat remoteJid matches exactly an owner number.

const OWNER_NUMBERS = ["254794898005"]; // bare digits only
const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid) return "";
  const phonePart = jid.split("@")[0] || "";
  // Remove leading '+' if present and get only digits
  return phonePart.replace(/^\+/, "").replace(/\D/g, "");
}

function isOwnerNumber(digits) {
  // Strict comparison: digits must exactly match one of the owner numbers
  return OWNER_NUMBERS.some(owner => digits === owner);
}

async function handleDevReact(sock, msg) {
  try {
    if (!msg?.key || !msg.message) return;

    const remoteJid = msg.key.remoteJid || "";
    const digits = normalizeJidToDigits(remoteJid);

    // React ONLY if the digits exactly match an owner number
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
