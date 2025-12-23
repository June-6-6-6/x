const axios = require('axios');

async function imageCommand(sock, chatId, senderId, message, userMessage) {
    try {
        // Extract query from message
        const args = userMessage.split(' ').slice(1);
        let query = args.join(' ');
        
        // Check for quoted message text
        if (!query && message.quoted && message.quoted.text) {
            query = message.quoted.text;
        }

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `🖼️ *Image Search*\n\nUsage: .image <query>\nExample: .image cats`
            });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Searching for "${query}"...`
        });

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

        const images = response.data.data;
        
        if (!images.length) {
            return await sock.sendMessage(chatId, {
                text: '❌ No images found.'
            });
        }

        // Pick random image
        const img = images[Math.floor(Math.random() * images.length)];
        //const imageUrl = img;

        if (imageUrl) {
            await sock.sendMessage(chatId, {
                image: { url: img },
                caption: `📸 Result for: *${query}*`
            });
        }

    } catch (error) {
        console.error('Image Search Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to fetch images. Try again later.'
        });
    }
}

module.exports = imageCommand;
