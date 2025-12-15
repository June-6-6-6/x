// devReact.js
// Reacts with 👑 only when an owner number sends a message.
// Works across private and group chats with robust normalization.

const OWNER_NUMBERS = [
  // Bare digits only (no +, no @, no spaces)
  "254794898005"
];

const EMOJI = "👑";

// Normalize a JID (e.g. "2637xxx@s.whatsapp.net" or "210883330461778@lid")
// -> returns only digits string like "2637xxx" or "210883330461778"
function normalizeJidToDigits(jid) {
  if (!jid || typeof jid !== "string") return "";
  const local = jid.split("@")[0] || jid;
  return local.replace(/\D/g, "");
}

function isOwnerNumber(normalizedDigits) {
  if (!normalizedDigits) return false;
  // Strict exact match only (no partials, no contains)
  return OWNER_NUMBERS.includes(normalizedDigits);
}

async function handleDevReact(sock, msg) {
  try {
    if (!msg || !msg.key || !msg.message) return;

    const remoteJid = msg.key.remoteJid || "";
    const isGroup = remoteJid.includes("@g.");

    // Sender in group is participant, in private it's remoteJid
    const rawSender = isGroup ? msg.key.participant : remoteJid;
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    console.log("📌 Raw sender JID:", rawSender);
    console.log("🔎 Normalized sender digits:", normalizedSenderDigits);
    console.log("👥 Owner list:", OWNER_NUMBERS.join(", "));

    if (isOwnerNumber(normalizedSenderDigits)) {
      console.log("👑 Owner detected — sending reaction...");

      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: msg.key
        }
      });

      console.log("✅ Reaction sent!");
    } else {
      console.log("❌ Not owner:", normalizedSenderDigits);
    }
  } catch (err) {
    console.error("❌ Error in devReact:", err);
  }
}

module.exports = { handleDevReact, normalizeJidToDigits };
