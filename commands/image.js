const axios = require('axios');

async function searchImagesFromAPI(apiUrl) {
    try {
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = response.data;
        let images = [];

        console.log(`API Response from ${apiUrl}:`, JSON.stringify(data, null, 2).substring(0, 500));

        // Check for different API response structures
        if (apiUrl.includes('mrfrankofc')) {
            // Check multiple possible response formats
            if (data?.status === true && Array.isArray(data?.result)) {
                images = data.result;
            } else if (Array.isArray(data?.data)) {
                images = data.data;
            } else if (Array.isArray(data)) {
                images = data; // Direct array response
            }
        } else if (apiUrl.includes('davidcyriltech')) {
            if (data?.success && Array.isArray(data?.results)) {
                images = data.results;
            } else if (Array.isArray(data?.data)) {
                images = data.data;
            } else if (Array.isArray(data)) {
                images = data;
            }
        }

        // Fallback: try common keys in any order
        if (images.length === 0) {
            const commonKeys = ['images', 'results', 'data', 'photos', 'pictures', 'items'];
            for (const key of commonKeys) {
                if (Array.isArray(data?.[key])) {
                    images = data[key];
                    console.log(`Found images in key: ${key}`);
                    break;
                }
            }
            
            // If still empty and data is an array, use it directly
            if (images.length === 0 && Array.isArray(data)) {
                images = data;
            }
        }

        console.log(`Found ${images.length} images from ${apiUrl}`);
        return images;
    } catch (error) {
        console.error(`API ${apiUrl} error:`, error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return [];
    }
}

function extractImageUrl(image) {
    // Try multiple possible image URL properties
    const urlProperties = [
        'url',
        'link',
        'image',
        'src',
        'thumbnail',
        'original',
        'medium',
        'large',
        'full',
        'webformatURL',
        'largeImageURL',
        'previewURL'
    ];

    for (const prop of urlProperties) {
        if (image[prop] && typeof image[prop] === 'string') {
            // Ensure URL is valid
            const url = image[prop].trim();
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
        }
    }

    // If image is a string URL
    if (typeof image === 'string' && 
        (image.startsWith('http://') || image.startsWith('https://'))) {
        return image.trim();
    }

    return null;
}

async function imageCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query || query.trim() === '') {
            return await sock.sendMessage(chatId, {
                text: `🖼️ *Image Search Command*\n\nUsage:\n${getPrefix()}image <search_query>\n\nExample:\n${getPrefix()}image cute cats\n${getPrefix()}image nature landscape`
            });
        }

        const searchQuery = query.trim();
        await sock.sendMessage(chatId, {
            text: `🔍 Searching images for "${searchQuery}"...`
        });

        // Multiple APIs with improved URLs
        const apis = [
            `https://api.mrfrankofc.gleeze.com/api/images?query=${encodeURIComponent(searchQuery)}`,
            `https://api.davidcyriltech.xyz/api/imagesearch?query=${encodeURIComponent(searchQuery)}`,
            // Alternative APIs
            `https://api.mrfrankofc.gleeze.com/api/image-search?query=${encodeURIComponent(searchQuery)}`,
            `https://api.davidcyriltech.xyz/api/image/search?query=${encodeURIComponent(searchQuery)}`
        ];

        let images = [];
        let usedAPI = '';

        // Try each API until we get results
        for (const apiUrl of apis) {
            console.log(`Trying API: ${apiUrl}`);
            images = await searchImagesFromAPI(apiUrl);
            if (images.length > 0) {
                usedAPI = new URL(apiUrl).hostname;
                console.log(`Using API: ${usedAPI} with ${images.length} images`);
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
        const failedUrls = [];

        for (const image of imagesToSend) {
            try {
                const imageUrl = extractImageUrl(image);
                
                if (!imageUrl) {
                    console.warn('⚠️ No valid image URL found in:', image);
                    continue;
                }

                console.log(`Attempting to send image: ${imageUrl.substring(0, 100)}...`);

                // Send image with timeout
                await Promise.race([
                    sock.sendMessage(chatId, {
                        image: { url: imageUrl },
                        caption: `📸 ${searchQuery}`,
                        mimetype: 'image/jpeg'
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Image send timeout')), 10000)
                    )
                ]);

                sentCount++;
                console.log(`✅ Sent image ${sentCount}/${imagesToSend.length}`);

                // Delay between sends to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (imageError) {
                console.error('Error sending image:', imageError.message);
                failedUrls.push(image);
            }
        }

        const statusMessage = sentCount > 0 
            ? `✅ Sent ${sentCount} images for "${searchQuery}" via ${usedAPI}\n📸 *Total Found:* ${images.length}${failedUrls.length > 0 ? `\n⚠️ Failed to send: ${failedUrls.length} images` : ''}`
            : '❌ Failed to send any images. All URLs might be invalid or blocked.';

        await sock.sendMessage(chatId, {
            text: statusMessage
        });

    } catch (error) {
        console.error('Image Search Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error searching for images. Please try again with different keywords.'
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
