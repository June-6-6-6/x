const settings = require("../settings");

function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    const parts = [];
    if (d > 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
    if (h > 0) parts.push(`${h} hr${h !== 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} min${m !== 1 ? 's' : ''}`);
    if (s > 0 || parts.length === 0) parts.push(`${s} sec${s !== 1 ? 's' : ''}`);
    
    return parts.join(' ');
}

function getSystemInfo() {
    const os = require('os');
    const formatMemory = (bytes) => {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    };

    return {
        platform: os.platform(),
        arch: os.arch(),
        cpu: os.cpus()[0].model,
        memory: {
            total: formatMemory(os.totalmem()),
            used: formatMemory(os.totalmem() - os.freemem()),
            free: formatMemory(os.freemem())
        },
        uptime: runtime(os.uptime())
    };
}

async function aliveCommand(sock, chatId, message) {
    try {
        const botUptime = runtime(process.uptime());
        const systemInfo = getSystemInfo();
        const packageJson = require('../package.json'); // Adjust path as needed
        
        const aliveMessage = `
🤖 *${settings.botName || 'JUNE MD'} - STATUS*

🟢 *Bot Uptime:* ${botUptime}
💻 *System Uptime:* ${systemInfo.uptime}

📊 *System Information:*
┌ Platform: ${systemInfo.platform} (${systemInfo.arch})
├ CPU: ${systemInfo.cpu}
├ Memory: ${systemInfo.memory.used} / ${systemInfo.memory.total}
└ Free: ${systemInfo.memory.free}

📦 *Bot Information:*
┌ Version: ${packageJson.version || '1.0.0'}
├ Node.js: ${process.version}
└ Developer: ${settings.developer || 'Unknown'}

⚡ *Performance:*
┌ Response Time: Calculating...
└ Memory Usage: ${formatMemory(process.memoryUsage().rss)}

💬 *Commands Loaded:* ${Object.keys(require.cache).filter(x => x.includes('commands')).length}

${settings.footerText || '❤️ Powered by JUNE MD'}
        `.trim();

        const startTime = Date.now();
        
        // Send initial message
        const sentMsg = await sock.sendMessage(chatId, {
            text: aliveMessage.replace('Calculating...', 'Measuring...'),
            contextInfo: {
                forwardingScore: 999,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '@newsletter',
                    newsletterName: settings.botName || '𝐉ᴜɴᴇ 𝐌ᴅ',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

        // Calculate response time and update message
        const responseTime = Date.now() - startTime;
        const updatedMessage = aliveMessage.replace('Calculating...', `${responseTime}ms`);

        // Edit message with actual response time
        await sock.sendMessage(chatId, {
            text: updatedMessage,
            edit: sentMsg.key
        });

    } catch (error) {
        console.error('Error in alive command:', error);
        
        // Fallback simple message if detailed one fails
        try {
            await sock.sendMessage(chatId, {
                text: `🤖 *${settings.botName || 'JUNE MD'} is Alive!*\n\nUptime: ${runtime(process.uptime())}\n\n❌ Detailed status unavailable.`,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: false
                }
            }, { quoted: message });
        } catch (fallbackError) {
            console.error('Fallback message also failed:', fallbackError);
        }
    }
}

// Helper function to format memory
function formatMemory(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

module.exports = {
    name: 'alive',
    description: 'Check if the bot is running and view system status',
    command: aliveCommand,
    runtime: runtime // Export runtime function for reuse
};
