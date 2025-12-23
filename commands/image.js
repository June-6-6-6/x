const axios = require('axios');

async function searchImagesFromAPI(query, apiUrl) {
    try {
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;
        let images = [];

        // Handle MrFrank API structure
        if (apiUrl.includes('mrfrankofc')) {
            if (data.status === true && data.result && Array.isArray(data.result)) {
                images = data.result;
            } else if (data.data && Array.isArray(data.data)) {
                images = data.data;
            }
        }
        // Handle David Cyril API structure (fallback)
        else if (apiUrl.includes('davidcyriltech')) {
            if (data.success && data.results && Array.isArray(data.results)) {
                images = data.results;
            }
        }

        return images;
    } catch (error) {
        console.error(`API ${apiUrl} error:`, error.message);
        return [];
    }
}

async function imageCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `🖼️ *Image Search Command*\n\nUsage:\n${getPrefix()}image <search_query>\n\nExample:\n${getPrefix()}image cute cats\n${getPrefix()}image nature landscape`
            });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Searching images for "${query}"...`
        });

        // Try multiple APIs with fallback
        const apis = [
            `https://api.mrfrankofc.gleeze.com/api/images?query=${encodeURIComponent(query)}`,
        ];

        let images = [];
        let usedAPI = '';

        for (const apiUrl of apis) {
            images = await searchImagesFromAPI(query, apiUrl);
            if (images.length > 0) {
                usedAPI = apiUrl.includes('mrfrankofc') ? 'MrFrank API' : 'David Cyril API';
                break;
            }
        }

        if (images.length === 0) {
            return await sock.sendMessage(chatId, {
                text: '❌ No images found for your query. Try different keywords.'
            });
        }

        const imagesToSend = images.slice(0, 5);
        let sentCount = 0;

        for (const image of imagesToSend) {
            try {
                let imageUrl = '';
                
                if (typeof image === 'string') {
                    imageUrl = image;
                } else if (image.url) {
                    imageUrl = image.url;
                } else if (image.link) {
                    imageUrl = image.link;
                }

                if (!imageUrl) continue;

                await sock.sendMessage(chatId, {
                    image: { url: imageUrl },
                    caption: `${query}`
                });

                sentCount++;
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (imageError) {
                console.error('Error sending image:', imageError);
            }
        }

        if (sentCount > 0) {
            await sock.sendMessage(chatId, {
                text: `✅ Successfully sent ${sentCount} images for "${query}"\n\n📸 *Total Found:* ${images.length} images`
            });
        }

    } catch (error) {
        console.error('Image Search Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error searching for images. Please try again.'
        });
    }
}

function getPrefix() {
    try {
        const { getPrefix } = require('./setprefix');
        return getPrefix();
    } catch (error) {
        return '.';
    }
}

module.exports = imageCommand;
