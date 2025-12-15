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
  return OWNER_NUMBERS.includes(normalizedDigits);
}

async function handleDevReact(sock, msg) {
  try {
    if (!msg || !msg.key || !msg.message) return;

    const remoteJid = msg.key.remoteJid || "";
    const isGroup = remoteJid.includes("@g.");

    // Sender is participant in group, or remoteJid in private
    const rawSender = isGroup ? msg.key.participant : remoteJid;
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    console.log("Sender:", normalizedSenderDigits);

    if (isOwnerNumber(normalizedSenderDigits)) {
      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: msg.key
        }
      });
      console.log("Reaction sent");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
