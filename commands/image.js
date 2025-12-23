const axios = require('axios');

async function imageCommand(sock, chatId, message) {
    try {
        // Get the prompt from the message
        const prompt = message.message?.conversation?.trim() || 
                      message.message?.extendedTextMessage?.text?.trim() || '';
        
        // Remove the command prefix and trim
        const imageQuery = prompt.replace(/^\.?image\s+/i, '').trim();
        
        if (!imageQuery) {
            await sock.sendMessage(chatId, {
                text: '🔍 Please provide a search query for image search.\nExample: .image beautiful sunset'
            }, {
                quoted: message
            });
            return;
        }

        // Send processing message
        await sock.sendMessage(chatId, {
            text: '🔍 Searching for images... Please wait.'
        }, {
            quoted: message
        });

        // Make API request
        const apiUrl = `https://api.zenzxz.my.id/api/search/googleimage?query=${encodeURIComponent(imageQuery)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const data = response.data;

        if (!data || !data.data || data.data.length === 0) {
            await sock.sendMessage(chatId, {
                text: '❌ No images found for your query.'
            }, {
                quoted: message
            });
            return;
        }

        // Pick a random image from the results
        const randomIndex = Math.floor(Math.random() * data.data.length);
        const img = data.data[randomIndex];

        if (!img || !img.url) {
            await sock.sendMessage(chatId, {
                text: '❌ No valid image URL found in the results.'
            }, {
                quoted: message
            });
            return;
        }

        try {
            // Try to download the image as buffer first
            const imageResponse = await axios.get(img.url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                maxContentLength: 10 * 1024 * 1024,
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
            
            // Send the downloaded image
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: `📸 Image result for: "${imageQuery}"`
            }, {
                quoted: message
            });

        } catch (downloadError) {
            console.error('Buffer download failed, using URL method:', downloadError.message);
            
            // Fallback to URL method if buffer download fails
            await sock.sendMessage(chatId, {
                image: { url: img.url },
                caption: `📸 Image result for: "${imageQuery}"`
            }, {
                quoted: message
            });
        }

    } catch (error) {
        console.error('Error in image command:', error);
        
        if (error.code === 'ECONNABORTED') {
            await sock.sendMessage(chatId, {
                text: '⏰ Request timeout. The image search is taking too long. Please try again.'
            }, {
                quoted: message
            });
        } else if (error.response?.status === 404) {
            await sock.sendMessage(chatId, {
                text: '❌ Image search service is currently unavailable.'
            }, {
                quoted: message
            });
        } else if (error.response?.status === 403) {
            await sock.sendMessage(chatId, {
                text: '🚫 Access to image search is currently restricted.'
            }, {
                quoted: message
            });
        } else {
            await sock.sendMessage(chatId, {
                text: '❌ Failed to search for images. Please try again later.'
            }, {
                quoted: message
            });
        }
    }
}

module.exports = imageCommand;
