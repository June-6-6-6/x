const axios = require('axios');

async function imageCommand(sock, chatId, message) {
    try {
        const pushname = message.pushName || "User";

        // Extract text from message
        const text = message.message?.conversation?.trim() || 
                     message.message?.extendedTextMessage?.text?.trim() || '';
        
        const args = text.split(' ');
        const command = args[0].toLowerCase();
        const query = args.slice(1).join(' ');

        if (!query) {
            await sock.sendMessage(chatId, { 
                text: '⚠️ Please provide a search query!\n\nExample: .image cute cats' 
            });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Searching for images of *${query}*...`
        });

        // Call API
        const apiUrl = `https://api.zenzxz.my.id/api/search/googleimage?query=${encodeURIComponent(query)}&limit=12`;
        const response = await axios.get(apiUrl, { timeout: 20000 });
        const data = response.data;

        if (!data || !data.data || data.data.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "❌ No images found for your query."
            }, { quoted: message });
        }

        // Take first 6–8 images
        const imagesToSend = data.data.slice(0, 6);

        await sock.sendMessage(chatId, {
            text: `📦 Found ${imagesToSend.length} images\n⏳ Sending now...` 
        });

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < imagesToSend.length; i++) {
            const img = imagesToSend[i];
            if (!img || !img.url) {
                failedCount++;
                continue;
            }

            try {
                await sock.sendMessage(chatId, {
                    image: { url: img.url },
                    caption: `📷 ${i + 1}/${imagesToSend.length} - ${query}`
                });
                successCount++;
            } catch (err) {
                console.error(`Failed to send image ${i + 1}:`, err.message);
                failedCount++;
            }
        }

        // Completion message
        await sock.sendMessage(chatId, { 
            text: `✅ Sent ${successCount}/${imagesToSend.length} images for *${query}*${failedCount > 0 ? `\n❌ ${failedCount} failed` : ''}` 
        });

    } catch (error) {
        console.error("Image Command Error:", error);
        await sock.sendMessage(chatId, { 
            text: "❌ An unexpected error occurred.\n\nError details: " + error.message 
        }, { quoted: message });
    }
}

module.exports = imageCommand;
