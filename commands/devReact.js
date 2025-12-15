// devReact.js
// Reacts with 👑 to owner messages in all chats

const OWNER_NUMBERS = ["263715305976"]; // Add more numbers if needed
const EMOJI = "👑";

function normalizeToDigits(input) {
  if (!input) return "";
  return input.replace(/\D/g, "");
}

async function handleDevReact(sock, msg) {
  try {
    if (!msg?.key?.remoteJid || !msg.message) return;

    const remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.includes("@g.us");
    const senderJid = isGroup ? msg.key.participant : remoteJid;
    const senderDigits = normalizeToDigits(senderJid);

    const normalizedOwners = OWNER_NUMBERS.map(normalizeToDigits);

    if (normalizedOwners.includes(senderDigits)) {
      await sock.sendMessage(remoteJid, {
        react: { text: EMOJI, key: msg.key }
      });
      console.log(`✅ Reacted to ${senderDigits}`);
    } else {
      console.log(`ℹ️ Skipped ${senderDigits}`);
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

module.exports = { handleDevReact };
