// devReact.js
// Reacts with 👑 to owner messages in all chats

const OWNER_NUMBERS = ["254794898005"]; // Add more numbers if needed
const EMOJI = "👑";

function normalizeToDigits(input) {
  if (!input) return "";
  return input.replace(/\D/g, "");
}

async function handleDevReact(sock, message) {
  try {
    if (!message?.key?.remoteJid || !message.message) return;

    const remoteJid = message.key.remoteJid;
    const isGroup = remoteJid.includes("@g.us");
    const senderJid = isGroup ? message.key.participant : remoteJid;
    const senderDigits = normalizeToDigits(senderJid);

    const normalizedOwners = OWNER_NUMBERS.map(normalizeToDigits);

    if (normalizedOwners.includes(senderDigits)) {
      await sock.sendMessage(remoteJid, {
        react: { text: EMOJI, key: message.key }
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
