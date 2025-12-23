const axios = require('axios');

// Create fake contact for enhanced replies
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "TRASHCORE-MD"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:TRASHCORE MD\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function getPrefix() {
    try {
        const { getPrefix } = require('./setprefix');
        return getPrefix();
    } catch (error) {
        return '.';
    }
}

async function imageCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const fake = createFakeContact(message);
        
        // Extract query from message
        const args = userMessage.split(' ').slice(1);
        let query = args.join(' ');
        
        // Check for quoted message text
        if (!query && message.quoted && message.quoted.text) {
            query = message.quoted.text;
        }

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `🖼️ *Image Search*\n\nUsage: ${getPrefix()}image <query>\nExample: ${getPrefix()}image cats`
            }, { quoted: fake });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Searching for "${query}"...`
        }, { quoted: fake });

        // Fetch images from API
        const response = await axios.get(
            `https://api.zenzxz.my.id/api/search/googleimage?query=${encodeURIComponent(query)}`,
            {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        );

        const images = response.data?.data || [];
        
        if (!images.length) {
            return await sock.sendMessage(chatId, {
                text: '❌ No images found.'
            }, { quoted: fake });
        }

        // Pick random image
        const img = images[Math.floor(Math.random() * images.length)];
        const imageUrl = img.url || img;

        if (imageUrl) {
            await sock.sendMessage(chatId, {
                image: { url: imageUrl },
                caption: `📸 Result for: *${query}*`
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('Image Search Error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to fetch images. Try again later.'
        }, { quoted: fake });
    }
}

module.exports = imageCommand;
