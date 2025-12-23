const axios = require('axios');

async function imageCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a search query!"
            });
        }

        // Extract the query by removing command prefix
        const query = text.replace(/^\/(img|image)\s+|^!(img|image)\s+|^(img|image)\s+/i, '').trim();
        
        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a search query!\n\nExamples:\n• `image butterfly`\n• `img sunset`\n• `/image cat`\n• `/img dog`"
            });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Searching images for: *${query}*\n📸 Preparing 8 images...`
        });

        try {
            const apiUrl = `https://api.zenzxz.my.id/api/search/googleimage?query=${encodeURIComponent(query)}`;
            
            const response = await axios.get(apiUrl, { 
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const data = response.data;

            if (!data || !data.data || data.data.length === 0) {
                return await sock.sendMessage(chatId, { 
                    text: `❌ No images found for: *${query}*`
                }, { quoted: message });
            }

            // Get up to 8 unique images
            const maxImages = Math.min(8, data.data.length);
            const selectedImages = [];
            
            // Shuffle the array and pick first 8
            const shuffled = [...data.data].sort(() => Math.random() - 0.5);
            for (let i = 0; i < maxImages; i++) {
                if (shuffled[i] && shuffled[i].url) {
                    selectedImages.push(shuffled[i]);
                }
            }

            if (selectedImages.length === 0) {
                return await sock.sendMessage(chatId, { 
                    text: `❌ No valid images found for: *${query}*`
                }, { quoted: message });
            }

            // Prepare media array for sending multiple images
            const mediaMessages = selectedImages.map((img, index) => ({
                image: { url: img.url },
                caption: `📸 ${index + 1}/${selectedImages.length}: *${query}*`
            }));

            // Send images in batches to avoid flooding
            let sentCount = 0;
            const batchSize = 2; // Send 2 images at a time
            
            for (let i = 0; i < mediaMessages.length; i += batchSize) {
                const batch = mediaMessages.slice(i, i + batchSize);
                
                for (const media of batch) {
                    try {
                        await sock.sendMessage(chatId, media);
                        sentCount++;
                    } catch (err) {
                        console.error(`Failed to send image ${sentCount + 1}:`, err.message);
                    }
                }
                
                // Wait between batches
                if (i + batchSize < mediaMessages.length) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }

            // Completion message
            await sock.sendMessage(chatId, { 
                text: `✅ Sent *${sentCount}/${selectedImages.length}* images for: *${query}*`
            });

        } catch (error) {
            console.error("Image Search Error:", error);
            
            let errorMessage = `❌ Failed to fetch images for: *${query}*. Try again later.`;
            
            if (error.code === 'ECONNABORTED') {
                errorMessage = `❌ Request timeout while searching for: *${query}*.`;
            } else if (error.response?.status === 404) {
                errorMessage = "❌ Image search API not found.";
            } else if (error.response?.status === 403) {
                errorMessage = "❌ Access forbidden by image search API.";
            }
            
            await sock.sendMessage(chatId, { 
                text: errorMessage
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in Image command:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ An unexpected error occurred. Please try again later."
        }, { quoted: message });
    }
}

module.exports = imageCommand;
