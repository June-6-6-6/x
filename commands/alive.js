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

⏰ *Uptime:* ${formattedUptime}
🔄 *Version:* ${settings.version || 'undefined !'}
📱 *Powered by:* ${settings.botName || 'WhatsApp Bot'}

🔵 Use *menu* to see all available commands`;

        // Create fake contact for enhanced replies
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "JUNE-X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

 const fake = createFakeContact(message);
// Use the local asset image
        
const fs = require('fs');
const path = require('path');
        
    const imgPath = path.join(__dirname, '../assets/menu3.jpg');
    const imgBuffer2 = fs.readFileSync(imgPath);
        
        await sock.sendMessage(chatId, {
            text: message1,
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: false,
                    title: "JUNE-X BOT",
                    body: "© 2025",
                    thumbnail: imgBuffer2,
                    sourceUrl: "https://github.com/vinpink2",
                    mediaType: 1,
                    renderLargerThumbnail: true,
                },
            },
        }, { quoted: fake }); 
        // uptime
await sock.sendMessage(chatId, { text: `*JUNE-X* alive: ⏰ *${formattedUptime}*`},{ quoted: fake});
        
    } catch (error) {
        console.error('Error in alive command:', error);        
    }
}

module.exports = aliveCommand;
