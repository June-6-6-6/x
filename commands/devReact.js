const { jidDecode }= require('@whiskeysockets/baileys');
const OWNER_NUMBERS = [
  "254794898005"
];

const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid || typeof jid !== "string") return "";
  const local = jid.split("@")[0] || jid;
  return local.replace(/\D/g, "");
}

function isOwnerNumber(normalizedDigits) {
  if (!normalizedDigits) return false;
  for (const owner of OWNER_NUMBERS) {
    if (normalizedDigits === owner) return true;
    if (normalizedDigits.endsWith(owner)) return true;
    if (normalizedDigits.includes(owner)) return true;
  }
  return false;
}

async function handleDevReact(sock, message) {
  try {
    if (!message || !message.key) return;
    if (!message.message) return;

    const remoteJid = message.key.remoteJid || "";
    const isGroup = typeof remoteJid === "string" && remoteJid.includes("@g.");

    const rawSender = (isGroup ? message.key.participant : message.key.remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    console.log("📌 Raw sender JID:", rawSender);
    console.log("🔎 Normalized sender digits:", normalizedSenderDigits);
    console.log("👥 Owner list:", OWNER_NUMBERS.join(", "));

    if (isOwnerNumber(normalizedSenderDigits)) {
      console.log("👑 Owner detected — sending reaction...");

      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: message.key
        }
      });

      console.log("✅ Reaction sent!");
      return;
    }

    console.log("❌ Not owner:", normalizedSenderDigits);
  } catch (err) {
    console.error("❌ Error in devReact:", err);
  }
}

module.exports = handleDevReact;
