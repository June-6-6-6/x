const axios = require('axios');

async function imageCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';
        
        const used = (rawText || '').split(/\s+/)[0] || '.image';
        const query = rawText.slice(used.length).trim();
        
        if (!query) {
            await sock.sendMessage(chatId, { 
                text: 'Usage: .image <search query>\n\nExample: .image cute cats\nExample: .image sunset landscape' 
            }, { quoted: message });
            return;
        }

        // Send searching reaction
        await sock.sendMessage(chatId, {
            react: { text: '🔍', key: message.key }
        });

        // Fetch images from API
        const apiUrl = `https://api.zenzxz.my.id/api/search/googleimage?query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, { 
            timeout: 15000, 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            } 
        });

        if (!data?.data || data.data.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ No images found for this query.\n\nTry a different search term.' 
            }, { quoted: message });
            return;
        }

        // Pick a random image from results
        const randomIndex = Math.floor(Math.random() * data.data.length);
        const imageResult = data.data[randomIndex];
        
        // Send image with caption
        await sock.sendMessage(chatId, {
            image: { url: imageResult.url },
            caption: `📸 Result for: *${query}*\n\n🔗 Source: ${imageResult.url}`
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error('[IMAGE] error:', error?.message || error);
        const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to fetch images.\nError: ${errorMsg}\n\nTry again later or check your connection.` 
        }, { quoted: message });
    }
}

module.exports = imageCommand;
