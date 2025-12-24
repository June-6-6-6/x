// devReact.js
// Reacts with 👑 even if someone already reacted with the same emoji,
// but skips reacting to its own messages.

const OWNER_NUMBERS = [
  "+254794898005",
  "136129676312603"
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

async function handleDevReact(sock, msg) {
  try {
    if (!msg?.key || !msg.message) return;

    const remoteJid = msg.key.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");

    const rawSender = isGroup ? msg.key.participant : msg.key.remoteJid;
    const digits = normalizeJidToDigits(rawSender);

    // 🚫 Skip if not owner
    if (!isOwnerNumber(digits)) return;

    // 🚫 Skip if the sender is the bot itself
    const botDigits = normalizeJidToDigits(sock.user?.id);
    if (digits === botDigits) return;

    // 1️⃣ Remove any existing reaction
    await sock.sendMessage(remoteJid, {
      react: { text: "", key: msg.key }
    });

    // 2️⃣ Now send your reaction (guaranteed to show)
    await sock.sendMessage(remoteJid, {
      react: { text: EMOJI, key: msg.key }
    });

  } catch (err) {
    console.error("handleDevReact error:", err);
  }
}

module.exports = handleDevReact;
