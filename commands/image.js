const axios = require('axios');
const delay = time => new Promise(res => setTimeout(res, time));
const fs = require('fs');
const path = require('path');

async function imageCommand(sock, chatId, message) {
    try {
        const pushname = message.pushName || "User";
        
        // Get the URL from message
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

        try {
            // Using a more reliable API with better parameters
            const apiUrl = `https://api.zenzxz.my.id/api/search/googleimage?query=${encodeURIComponent(query)}&limit=12`;
            
            const response = await axios.get(apiUrl, { 
                timeout: 30000, // Increased timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            const data = response.data;

            if (!data || !data.data || data.data.length === 0) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ No images found for your query."
                }, { quoted: message });
            }

            // Take only the first 8 images
            const imagesToSend = data.data.slice(0, 8);
            let successCount = 0;
            let failedCount = 0;

            await sock.sendMessage(chatId, {
                text: `📦 Found ${imagesToSend.length} images\n⏳ Starting download...` 
            });

            // Send images one by one
            for (let i = 0; i < imagesToSend.length; i++) {
                try {
                    const img = imagesToSend[i];
                    if (!img || !img.url) {
                        failedCount++;
                        continue;
                    }

                    // Add delay between requests
                    if (i > 0) {
                        await delay(1500);
                    }

                    // Create temp directory if it doesn't exist
                    const tmpDir = path.join(process.cwd(), 'tmp_images');
                    if (!fs.existsSync(tmpDir)) {
                        fs.mkdirSync(tmpDir, { recursive: true });
                    }

                    // Download image with better error handling
                    let imageBuffer;
                    try {
                        const imageResponse = await axios.get(img.url, {
                            responseType: 'arraybuffer',
                            timeout: 15000,
                            maxContentLength: 10 * 1024 * 1024, // 10MB
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.9',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'Accept-Language': 'en-US,en;q=0.9',
                                'Referer': 'https://www.google.com/',
                                'Sec-Fetch-Dest': 'image',
                                'Sec-Fetch-Mode': 'no-cors',
                                'Sec-Fetch-Site': 'cross-site'
                            }
                        });

                        imageBuffer = Buffer.from(imageResponse.data);
                    } catch (downloadError) {
                        console.log(`Download failed for image ${i + 1}, trying fallback method...`);
                        
                        // Fallback: Use URL method
                        await sock.sendMessage(chatId, {
                            image: { url: img.url },
                            caption: `📷 ${i + 1}/8 - ${query}`
                        });
                        successCount++;
                        continue;
                    }

                    // Validate image buffer
                    if (imageBuffer && imageBuffer.length > 5000) { // Increased minimum size
                        // Save to temp file to validate
                        const tempFile = path.join(tmpDir, `img_${Date.now()}_${i}.tmp`);
                        fs.writeFileSync(tempFile, imageBuffer);
                        
                        try {
                            // Try to send as buffer
                            await sock.sendMessage(chatId, {
                                image: imageBuffer,
                                caption: `📷 ${i + 1}/8 - ${query}\n📍 Source: ${img.url ? new URL(img.url).hostname : 'Unknown'}`
                            });
                            successCount++;
                        } catch (sendError) {
                            console.log(`Buffer send failed for image ${i + 1}, trying URL method...`);
                            await sock.sendMessage(chatId, {
                                image: { url: img.url },
                                caption: `📷 ${i + 1}/8 - ${query}`
                            });
                            successCount++;
                        }
                        
                        // Cleanup temp file
                        try {
                            fs.unlinkSync(tempFile);
                        } catch (cleanupError) {
                            console.error('Error cleaning up temp file:', cleanupError);
                        }
                    } else {
                        console.log(`Image ${i + 1} too small or invalid, using URL method`);
                        await sock.sendMessage(chatId, {
                            image: { url: img.url },
                            caption: `📷 ${i + 1}/8 - ${query}`
                        });
                        successCount++;
                    }

                } catch (error) {
                    console.error(`Error processing image ${i + 1}:`, error.message);
                    failedCount++;
                    continue;
                }
            }

            // Send completion message
            if (successCount > 0) {
                await sock.sendMessage(chatId, { 
                    text: `✅ Successfully sent ${successCount}/8 images for *${query}*${failedCount > 0 ? `\n❌ ${failedCount} failed to load` : ''}` 
                });
            } else {
                await sock.sendMessage(chatId, { 
                    text: "❌ Failed to load any images. The image URLs might be invalid or blocked.\n\nPossible issues:\n1. API rate limit reached\n2. Network issues\n3. Invalid image URLs" 
                });
            }

        } catch (error) {
            console.error("Image Search Error:", error);
            
            let errorMessage = '❌ Failed to search for images.';
            
            if (error.code === 'ECONNABORTED') {
                errorMessage = '❌ Request timeout. The image search API is taking too long to respond.';
            } else if (error.response?.status === 404) {
                errorMessage = '❌ Image search API endpoint not found.';
            } else if (error.response?.status === 429) {
                errorMessage = '❌ Too many requests. Please wait a moment before trying again.';
            } else if (error.response?.status === 403) {
                errorMessage = '❌ Access forbidden. The API might be blocking requests.';
            } else if (error.message.includes('ENOTFOUND')) {
                errorMessage = '❌ Cannot connect to the image search API. Check your internet connection.';
            } else if (error.message.includes('Unexpected token')) {
                errorMessage = '❌ Invalid API response. The image search service might be down.';
            }
            
            await sock.sendMessage(chatId, { 
                text: `${errorMessage}\n\nTry:\n1. Using a different search term\n2. Waiting a few minutes\n3. Checking your internet connection` 
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in Image command:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ An unexpected error occurred. Please try again later.\n\nError details: " + error.message 
        }, { quoted: message });
    }
}

module.exports = imageCommand;
