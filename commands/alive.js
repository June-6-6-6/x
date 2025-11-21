const settings = require("../settings");

function runtime(seconds) {
    // Add input validation
    if (typeof seconds !== 'number' && isNaN(Number(seconds))) {
        return '0 seconds';
    }
    
    seconds = Number(seconds);
    
    // Handle negative values
    if (seconds < 0) {
        seconds = 0;
    }

    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    // Improved formatting - only show non-zero values
    const parts = [];
    if (d > 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
    if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
    if (s > 0 || parts.length === 0) parts.push(`${s} second${s !== 1 ? 's' : ''}`);
    
    return parts.join(' ');
}

async function aliveCommand(sock, chatId, message) {
    try {
        // Validate required parameters
        if (!sock || !chatId) {
            console.error('Missing required parameters: sock or chatId');
            return;
        }

        const uptime = runtime(process.uptime());
        
        // Create a more informative message
        const messageText = `🤖 *Bot Status*\n\n` +
                          `🟢 Online: ${uptime}\n` +
                          `💻 Platform: ${process.platform}\n` +
                          `📊 Node.js: ${process.version}\n` +
                          `🔧 Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`;

        await sock.sendMessage(chatId, {
            text: messageText,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '@newsletter',
                    newsletterName: settings.botName || '𝐉ᴜɴᴇ 𝐌ᴅ', // Use setting if available
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error('Error in alive command:', error);
        
        // Enhanced error handling with retry logic
        try {
            await sock.sendMessage(chatId, { 
                text: '❌ An error occurred while checking status. Please try again later.' 
            }, { quoted: message });
        } catch (sendError) {
            console.error('Failed to send error message:', sendError);
        }
    }
}

module.exports = aliveCommand;
