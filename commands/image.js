const axios = require('axios');

async function imageCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a search query!"
            });
        }

        const query = text.replace(/^image\s+/i, '').trim();
        
        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a search query!"
            });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Searching for images of *${query}*...`
        });

        try {
            // Using a more reliable API with better parameters
            const apiUrl = `https://api.zenzxz.my.id/api/search/googleimage?query=${encodeURIComponent(query)}&limit=10`;
            
            const response = await axios.get(apiUrl, { 
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });

            const data = response.data;

            if (!data || !data.data || data.data.length === 0) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ No images found."
                }, { quoted: message });
            }

            // Take only the first 8 images to ensure relevance
            const imagesToSend = data.data.slice(0, 8);
            let sentCount = 0;
            let failedCount = 0;

            // Send a batch message first
            await sock.sendMessage(chatId, {
                text: `📸 Found ${imagesToSend.length} images for *${query}*\nSending images...`
            });

            // Send images one by one with a delay to avoid rate limiting
            for (const img of imagesToSend) {
                if (!img || !img.url) {
                    failedCount++;
                    continue;
                }

                try {
                    // Add a small delay between sends
                    if (sentCount > 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    // Try to download and send as buffer first
                    const imageResponse = await axios.get(img.url, {
                        responseType: 'arraybuffer',
                        timeout: 10000,
                        maxContentLength: 5 * 1024 * 1024, // 5MB limit
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'Accept': 'image/*',
                            'Referer': 'https://www.google.com/'
                        }
                    });

                    const imageBuffer = Buffer.from(imageResponse.data);

                    if (imageBuffer.length > 1000) { // Ensure it's a valid image (>1KB)
                        await sock.sendMessage(chatId, {
                            image: imageBuffer,
                            caption: `📷 ${sentCount + 1}/8 - ${query}`
                        });
                        sentCount++;
                    } else {
                        failedCount++;
                    }
                } catch (downloadError) {
                    console.error(`Failed to download image ${sentCount + 1}:`, downloadError.message);
                    failedCount++;
                }
            }

            // Send summary
            await sock.sendMessage(chatId, {
                text: `✅ Successfully sent ${sentCount} images for *${query}*\n${failedCount > 0 ? `(${failedCount} failed to load)` : ''}`
            });

            if (sentCount === 0) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Failed to load any images. The image URLs might be invalid or blocked."
                });
            }

        } catch (error) {
            console.error("Image Search Error:", error);
            
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { 
                    text: "❌ Request timeout. The image search API is taking too long to respond."
                }, { quoted: message });
            } else if (error.response?.status === 404) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Image search API not found."
                }, { quoted: message });
            } else if (error.response?.status === 429) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Too many requests. Please wait a moment before trying again."
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `❌ Failed to fetch images: ${error.message || 'Unknown error'}`
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
