const axios = require('axios');

async function imageCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a search query!"
            });
        }

        // Extract the query by removing the command prefix
        let query;
        const textLower = text.toLowerCase();
        
        // Check for different command prefixes
        if (textLower.startsWith('image ')) {
            query = text.substring(6).trim(); // Remove "image " (6 characters)
        } else if (textLower.startsWith('img ')) {
            query = text.substring(4).trim(); // Remove "img " (4 characters)
        } else if (textLower.startsWith('/image ')) {
            query = text.substring(7).trim(); // Remove "/image " (7 characters)
        } else if (textLower.startsWith('/img ')) {
            query = text.substring(5).trim(); // Remove "/img " (5 characters)
        } else if (textLower.startsWith('!image ')) {
            query = text.substring(7).trim(); // Remove "!image " (7 characters)
        } else if (textLower.startsWith('!img ')) {
            query = text.substring(5).trim(); // Remove "!img " (5 characters)
        } else {
            // If no command prefix found, assume the whole text is the query
            query = text.trim();
        }
        
        // Alternative: Use regex to remove common command prefixes
        // query = text.replace(/^\/(img|image)\s+|^!(img|image)\s+|^(img|image)\s+/i, '').trim();
        
        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a search query!\n\nExamples:\n• `image butterfly`\n• `img sunset`\n• `/image cat`\n• `/img dog`"
            });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Searching images for: *${query}*`
        });

        try {
            const apiUrl = `https://api.zenzxz.my.id/api/search/googleimage?query=${encodeURIComponent(query)}`;
            
            const response = await axios.get(apiUrl, { 
                timeout: 15000,
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

            // Pick a random image from the results
            const randomIndex = Math.floor(Math.random() * data.data.length);
            const img = data.data[randomIndex];

            if (!img || !img.url) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ No valid image URL found."
                }, { quoted: message });
            }

            try {
                const imageResponse = await axios.get(img.url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    maxContentLength: 10 * 1024 * 1024, // 10MB limit for images
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/webp,image/*,*/*;q=0.9',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Referer': 'https://www.google.com/'
                    }
                });
                
                const imageBuffer = Buffer.from(imageResponse.data);
                
                if (imageBuffer.length === 0) {
                    throw new Error("Image buffer is empty");
                }
                
                await sock.sendMessage(chatId, {
                    image: imageBuffer,
                    caption: `📸 Image search: *${query}*`
                }, { quoted: message });

            } catch (downloadError) {
                console.error("Buffer download failed, trying URL method:", downloadError.message);
                
                await sock.sendMessage(chatId, {
                    image: { url: img.url },
                    caption: `📸 Image search: *${query}*`
                }, { quoted: message });
            }

        } catch (error) {
            console.error("Image Search Error:", error);
            
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { 
                    text: `❌ Request timeout while searching for: *${query}*. Please try again.`
                }, { quoted: message });
            } else if (error.response?.status === 404) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Image search API not found. The service might be temporarily unavailable."
                }, { quoted: message });
            } else if (error.response?.status === 403) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Access forbidden. The image search API might be blocking the request."
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `❌ Failed to fetch images for: *${query}*. Try again later.`
                }, { quoted: message });
            }
        }
    } catch (error) {
        console.error('Error in Image command:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ An unexpected error occurred. Please try again later."
        }, { quoted: message });
    }
}

module.exports = imageCommand;
