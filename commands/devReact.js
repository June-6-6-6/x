// devReact.js
// Reacts with 👑 only when an owner number sends a message.
// Robust normalization to handle domains like @lid, @s.whatsapp.net, @g.us, etc.

const OWNER_NUMBERS = [
  // Put all owner numbers here (bare digits only, no +, no @, no spaces)
  // Example: "263715305976"
  "254794898005"
];

const EMOJI = "👑";

/**
 * Normalize a JID (e.g. "2637xxx@s.whatsapp.net" or "210883330461778@lid")
 * -> returns only digits string like "2637xxx" or "210883330461778"
 */
function normalizeJidToDigits(jid = "") {
  if (typeof jid !== "string") return "";
  const local = jid.split("@")[0] || jid;
  return local.replace(/\D/g, "");
}

/**
 * Check if the normalized digits belong to an owner
 */
function isOwnerNumber(normalizedDigits = "") {
  if (!normalizedDigits) return false;
  return OWNER_NUMBERS.some(owner =>
    normalizedDigits === owner ||
    normalizedDigits.endsWith(owner) ||
    normalizedDigits.includes(owner)
  );
}

/**
 * Main handler: reacts with 👑 if sender is owner
 * @param {object} sock - WhatsApp socket connection
 * @param {string} chatId - The chat ID (remoteJid)
 * @param {object} message - The message object
 */
async function handledDevReact(sock, chatId, message) {
  try {
    if (!sock || typeof sock.sendMessage !== "function") {
      console.error("❌ Invalid socket object provided.");
      return;
    }

    if (!message || !message.key || !message.message) {
      console.log("⚠️ Skipping: invalid or empty message object.");
      return;
    }

    // Use the provided chatId parameter instead of extracting from message.key.remoteJid
    const remoteJid = chatId || message.key.remoteJid || "";
    const isGroup = remoteJid.includes("@g.");

    // Sender in group is participant, in private it's remoteJid
    const rawSender = (isGroup ? message.key.participant : remoteJid) || "";
    const normalizedSenderDigits = normalizeJidToDigits(rawSender);

    console.log("📌 Raw sender JID:", rawSender);
    console.log("🔎 Normalized sender digits:", normalizedSenderDigits);
    console.log("📱 Chat ID:", remoteJid);
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
    } else {
      console.log("❌ Not owner:", normalizedSenderDigits);
    }
  } catch (err) {
    console.error("❌ Error in handledDevReact:", err);
  }
}

module.exports = handledDevReact;
