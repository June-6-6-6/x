const os = require("os");

function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000);
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const botStartTime = Date.now();

function getPlatform() {
  if (process.env.DYNO) return "Heroku";
  if (process.env.RENDER) return "Render";
  if (os.platform() === "linux") return "Linux";
  if (os.platform() === "win32") return "Windows";
  if (os.platform() === "darwin") return "macOS";
  return "Server";
}

let bioInterval = null;

const statusTemplates = [
  (uptime, platform) => `⚡ Running ${uptime} on ${platform}`,
  (uptime, platform) => `🚀 Online ${uptime} • ${platform}`,
  (uptime, platform) => `✨ Active ${uptime} • ${platform}`,
  (uptime, platform) => `🌟 Uptime: ${uptime} • ${platform}`,
  (uptime, platform) => `📱 Bot ${uptime} • ${platform}`,
];

async function autobioCommand(sock, chatId, message, args) {
  try {
    if (!message.key.fromMe) {
      const senderName = message.pushName || "User";
      const warningText = `⚠️ *Owner Command Only*\n\nHey ${senderName}, this command can only be used by the bot owner.`;
      await sock.sendMessage(chatId, { text: warningText }, { quoted: message });
      return;
    }

    if (!args || args.length === 0) {
      const helpText = `🤖 *Autobio Commands*\n\n• *!autobio on* - Start auto bio\n• *!autobio off* - Stop auto bio\n• *!autobio status* - Show current info\n\n*Owner command only*`;
      return await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
    }

    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'on':
      case 'start':
      case 'enable':
        startAutoBio(sock);
        await sock.sendMessage(chatId, { text: "✅ *Auto-bio started!*\nStatus will update every minute with random messages." }, { quoted: message });
        break;
        
      case 'off':
      case 'stop':
      case 'disable':
        stopAutoBio();
        await sock.sendMessage(chatId, { text: "⏹️ *Auto-bio stopped!*" }, { quoted: message });
        break;
        
      case 'status':
      case 'info':
        const uptime = Date.now() - botStartTime;
        const platform = getPlatform();
        const statusText = `📊 *Bot Status*\n\n• *Uptime:* ${formatUptime(uptime)}\n• *Platform:* ${platform}\n• *Auto-bio:* ${bioInterval ? 'ON ✅' : 'OFF ❌'}\n• *Started:* ${new Date(botStartTime).toLocaleTimeString()}`;
        await sock.sendMessage(chatId, { text: statusText }, { quoted: message });
        break;
        
      default:
        await sock.sendMessage(chatId, { text: "❌ *Usage:* !autobio [on/off/status]\n*Note:* Owner command only" }, { quoted: message });
    }
    
  } catch (error) {
    console.error('Autobio error:', error);
  }
}

function startAutoBio(sock) {
  if (bioInterval) clearInterval(bioInterval);
  updateBio(sock);
  bioInterval = setInterval(() => {
    updateBio(sock);
  }, 60000);
  console.log('[Auto-Bio] Started');
}

function stopAutoBio() {
  if (bioInterval) {
    clearInterval(bioInterval);
    bioInterval = null;
    console.log('[Auto-Bio] Stopped');
  }
}

async function updateBio(sock) {
  try {
    const uptime = Date.now() - botStartTime;
    const platform = getPlatform();
    const randomTemplate = statusTemplates[Math.floor(Math.random() * statusTemplates.length)];
    const statusMessage = randomTemplate(formatUptime(uptime), platform);
    await sock.updateProfileStatus(statusMessage);
    console.log(`[Auto-Bio] Updated: ${statusMessage}`);
  } catch (error) {
    console.error('Bio update error:', error);
    stopAutoBio();
  }
}

process.on('SIGINT', () => {
  if (bioInterval) clearInterval(bioInterval);
});

module.exports = autobioCommand;
