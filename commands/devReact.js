// devReact.js

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

async function handleDevReact(sock, msg) {
  try {
    if (!msg || !msg.key) return;
    if (!msg.message) return;

    const remoteJid = msg.key.remoteJid || "";
    const isGroup = typeof remoteJid === "string" && remoteJid.includes("@g.");
    const rawSender = (isGroup ? msg.key.participant : msg.key.remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    if (isOwnerNumber(normalizedSenderDigits)) {
      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: msg.key
        }
      });
      console.log("👑 Reaction sent to owner message");
    }
  } catch (err) {
    console.error("Error in devReact:", err);
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
