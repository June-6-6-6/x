const settings = require("../settings");

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

// Store bot start time
const botStartTime = Date.now();

async function aliveCommand(sock, chatId, message) {
    try {
        const uptime = Date.now() - botStartTime;
        const formattedUptime = formatUptime(uptime);
        
        const message1 = `ℹ️ *BOT STATUS* 

✅ *JUNE X is Alive and Running!*
⏰ *Uptime:* ${formattedUptime}
🔄 *Version:* ${settings.version || 'undefined !'}
📱 *Powered by:* ${settings.botName || 'WhatsApp Bot'}

🟢 Use *menu* to see all available commands`;

        await sock.sendMessage(chatId, {
            image: { url: },
            caption: message1,
            contextInfo: {
                externalAdReply: {
                    title: 'JUNE-X',
                    body: "𝐉ᴜɴᴇ",
                    mediaType: 1,
                    sourceUrl: "https://github.com/Vinpink2",
                    thumbnailUrl: "https://files.catbox.moe/a0gfje.jpg",
                    renderLargerThumbnail: false,
                    showAdAttribution: false
                }
            }
        },{ quoted: message});  
        // uptime
await sock.sendMessage(chatId, { text: `🔸 *${formattedUptime}*`},{ quoted: message});
        
    } catch (error) {
        console.error('Error in alive command:', error);        
    }
}

module.exports = aliveCommand;
