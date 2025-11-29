const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('../settings');

// Detect host/platform
function detectPlatform() {
  if (process.env.DYNO) return "☁️ Heroku";
  if (process.env.RENDER) return "⚡ Render";
  if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "📱 Termux";
  if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return "🌀 CypherX Platform";
  if (process.env.P_SERVER_UUID) return "🖥️ Panel";
  if (process.env.LXC) return "🐧 Linux Container (LXC)";
  switch (os.platform()) {
    case "win32": return "🪟 Windows";
    case "darwin": return "🍎 macOS";
    case "linux": return "🐧 Linux";
    default: return "❓ Unknown";
  }
}

// Format uptime nicely
function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000);
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} second${secs > 1 ? 's' : ''}`);

  return parts.join(', ');
}

// Fake contact for fancy replies
function createFakeContact(message) {
  const number = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
  return {
    key: {
      participants: "0@s.whatsapp.net",
      remoteJid: "status@broadcast",
      fromMe: false,
      id: "JUNE-X"
    },
    message: {
      contactMessage: {
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE X\nitem1.TEL;waid=${number}:${number}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
      }
    },
    participant: "0@s.whatsapp.net"
  };
}

// Store bot start time
const botStartTime = Date.now();

// Alive command
async function aliveCommand(sock, chatId, message) {
  try {
    const uptime = Date.now() - botStartTime;
    const formattedUptime = formatUptime(uptime);
    const hostName = detectPlatform();

    const statusMessage = `✨ *JUNE-X BOT STATUS* ✨
⏰ *Uptime:* ${formattedUptime}
🎲 *Platform:* ${hostName}
🔄 *Version:* ${settings.version || 'undefined !'}
🤖 *Powered By:* ${settings.botName || 'WhatsApp Bot'}

📌 Type *menu* to explore all commands 🚀`;

    const fake = createFakeContact(message);

    const imgPath = path.join(__dirname, '../assets/menu3.jpg');
    const imgBuffer = fs.readFileSync(imgPath);

    await sock.sendMessage(chatId, {
      text: statusMessage,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          title: "JUNE-X BOT",
          body: "© 2025",
          thumbnail: imgBuffer,
          sourceUrl: "https://github.com/vinpink2",
          mediaType: 1,
          renderLargerThumbnail: true,
        },
      },
    }, { quoted: fake });

  } catch (error) {
    console.error('Error in aliveCommand:', error);
  }
}

// Export modules
module.exports = {
  aliveCommand };
