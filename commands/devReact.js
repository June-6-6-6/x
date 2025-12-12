// devReact.js - Strict Owner Check Version

const OWNER_NUMBERS = [
  "254786878689" // Store as pure digits, no +, no spaces
];

const EMOJI = "👑";

/**
 * Normalize a WhatsApp JID to pure digits.
 * Example: "263715305976@s.whatsapp.net" -> "263715305976"
 */
function normalizeJidToDigits(jid) {
  if (!jid || typeof jid !== "string") return "";
  try {
    const local = jid.split("@")[0] || jid;
    const cleaned = local.replace(/[^\d]/g, "");
    return cleaned.replace(/^0+/, ""); // strip leading zeros
  } catch (error) {
    console.error("Error in normalizeJidToDigits:", error);
    return "";
  }
}

/**
 * Strict owner check: exact match only
 */
function isOwnerNumber(normalizedDigits) {
  if (!normalizedDigits) return false;

  const cleanOwnerDigits = OWNER_NUMBERS.map(num =>
    num.replace(/[^\d]/g, "").replace(/^0+/, "")
  );

  const match = cleanOwnerDigits.includes(normalizedDigits);

  console.log(`🔍 Owner check: sender=${normalizedDigits}, owners=${cleanOwnerDigits.join(", ")}, match=${match}`);
  return match;
}

async function handleDevReact(sock, message) {
  try {
    console.log("\n=== DEV REACT HANDLER STARTED ===");

    if (!sock || typeof sock.sendMessage !== "function") {
      console.error("❌ Invalid sock object");
      return;
    }
    if (!message?.key?.remoteJid) {
      console.error("❌ Invalid message object");
      return;
    }

    const remoteJid = message.key.remoteJid;
    const isGroup = remoteJid.includes("@g.us");
    const rawSender = isGroup ? message.key.participant : remoteJid;

    console.log(`📱 Remote JID: ${remoteJid}`);
    console.log(`👥 Is Group: ${isGroup}`);
    console.log(`👤 Raw sender JID: ${rawSender}`);

    const normalizedSenderDigits = normalizeJidToDigits(rawSender);
    console.log(`🔢 Normalized sender digits: ${normalizedSenderDigits}`);

    if (!normalizedSenderDigits) {
      console.error("❌ Failed to normalize sender digits");
      return;
    }

    const isOwner = isOwnerNumber(normalizedSenderDigits);

    if (isOwner) {
      console.log(`🎯 OWNER DETECTED! (${normalizedSenderDigits})`);
      try {
        await sock.sendMessage(remoteJid, {
          react: { text: EMOJI, key: message.key }
        });
        console.log("✅ Reaction sent successfully!");
      } catch (err) {
        console.error("❌ Failed to send reaction:", err.message);
      }
    } else {
      console.log(`❌ Not an owner - Skipping reaction`);
    }

    console.log("=== DEV REACT HANDLER COMPLETED ===\n");
  } catch (err) {
    console.error("💥 CRITICAL ERROR in handleDevReact:", err);
  }
}

module.exports = handleDevReact;
