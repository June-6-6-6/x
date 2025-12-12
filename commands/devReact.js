// devReact.js
// Reacts with 👑 only when an owner number sends a message.

const OWNER_NUMBERS = [
  // Bare digits only
  "254794898005"
];

const EMOJI = "👑";

/**
 * Extract bare digits from a JID
 */
function jidToDigits(jid = "") {
  if (typeof jid !== "string") return "";
  return (jid.split("@")[0] || "").replace(/\D/g, "");
}

/**
 * Main handler: reacts with 👑 if sender is owner
 */
async function handledDevReact(sock, message) {
  try {
    if (!sock?.sendMessage) {
      console.error("❌ Invalid socket object provided.");
      return;
    }

    if (!message?.key) {
      console.log("⚠️ Skipping: invalid or empty message object.");
      return;
    }

    const remoteJid = message.key.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");

    // In groups, sender is participant; in private, it's remoteJid
    const senderJid = isGroup ? message.key.participant : remoteJid;
    const senderDigits = jidToDigits(senderJid);

    console.log("📌 Sender JID:", senderJid);
    console.log("🔎 Digits:", senderDigits);

    if (OWNER_NUMBERS.includes(senderDigits)) {
      console.log("👑 Owner detected — reacting...");
      await sock.sendMessage(remoteJid, {
        react: {
          text: EMOJI,
          key: message.key
        }
      });
      console.log("✅ Reaction sent!");
    } else {
      console.log("❌ Not owner:", senderDigits);
    }
  } catch (err) {
    console.error("❌ Error in handledDevReact:", err);
  }
}

module.exports = handledDevReact;
