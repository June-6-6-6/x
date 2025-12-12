// devReact.js
// Reacts with 👑 even if someone already reacted with the same emoji.

const OWNER_NUMBERS = [
  "+263715305976",
  "65765025779814"
];

const EMOJI = "👑";

function normalizeJidToDigits(jid) {
  if (!jid) return "";
  const local = jid.split("@")[0];
  return local.replace(/\D/g, "");
}

function isOwnerNumber(num) {
  return OWNER_NUMBERS.some(owner =>
    num === owner ||
    num.endsWith(owner) ||
    num.includes(owner)
  );
}

async function handleDevReact(sock, message) {
  try {
    if (!message?.key || !message.message) return;

    const remoteJid = message.key.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");

    const rawSender = isGroup ? message.key.participant : message.key.remoteJid;
    const digits = normalizeJidToDigits(rawSender);

    if (!isOwnerNumber(digits)) return;

    // 1️⃣ Remove any existing reaction
    await sock.sendMessage(remoteJid, {
      react: { text: "", key: message.key }
    });

    // 2️⃣ Now send your reaction (guaranteed to show)
    await sock.sendMessage(remoteJid, {
      react: { text: EMOJI, key: message.key }
    });

  } catch {}
}

module.exports = { handleDevReact };
