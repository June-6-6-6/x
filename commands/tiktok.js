const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        // Check if message has already been processed
        if (processedMessages.has(message.key.id)) {
            return;
        }
        
        // Add message ID to processed set
        processedMessages.add(message.key.id);
        
        // Clean up old message IDs after 5 minutes
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok video URL."
            });
        }

        // Extract URL from command (remove "tt" command if present)
        const url = text.replace(/^tt\s+/i, '').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok video URL."
            });
        }

        // Check for various TikTok URL formats
        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a valid TikTok video link."
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🕖', key: message.key }
        });

        try {
            // Use your original API
            const apiUrl = `https://apis-sandarux.zone.id/api/tiktok/tiktokdl?url=${encodeURIComponent(url)}`;
            
            const response = await axios.get(apiUrl, { 
                timeout: 15000,
                headers: {
                    'accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const data = response.data;

            if (!data || !data.status || !data.result) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ Failed to fetch TikTok video."
                }, { quoted: message });
            }

            const res = data.result;

            // Check if video URL exists
            if (!res.nowm) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ No video URL found in the response."
                }, { quoted: message });
            }

            const caption = `「 *TikTok Downloader* 」\n
🎵 Title: ${res.title || "Unknown"}
👤 Author: ${res.caption || "Unknown"}
🌍 Region: ${res.region || "Unknown"}
⏱ Duration: ${res.duration || "Unknown"}s
👀 Views: ${res.stats?.views || "Unknown"}
❤️ Likes: ${res.stats?.likes || "Unknown"}
💬 Comments: ${res.stats?.comment || "Unknown"}
🔁 Shares: ${res.stats?.share || "Unknown"}`;

            try {
                // Try to download video as buffer first for better reliability
                const videoResponse = await axios.get(res.nowm, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    maxContentLength: 100 * 1024 * 1024, // 100MB limit
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'video/mp4,video/*,*/*;q=0.9',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Referer': 'https://www.tiktok.com/'
                    }
                });
                
                const videoBuffer = Buffer.from(videoResponse.data);
                
                // Validate video buffer
                if (videoBuffer.length === 0) {
                    throw new Error("Video buffer is empty");
                }
                
                await sock.sendMessage(chatId, {
                    video: videoBuffer,
                    caption: caption,
                    mimetype: "video/mp4"
                }, { quoted: message });

                await sock.sendMessage(chatId, {
                    react: { text: '✅', key: message.key }
                });

            } catch (downloadError) {
                console.error("Buffer download failed, trying URL method:", downloadError.message);
                
                // Fallback to URL method
                await sock.sendMessage(chatId, {
                    video: { url: res.nowm },
                    caption: caption,
                    mimetype: "video/mp4"
                }, { quoted: message });

                await sock.sendMessage(chatId, {
                    react: { text: '✅', key: message.key }
                });
            }

        } catch (error) {
            console.error("TikTok Error:", error);
            
            // More specific error messages
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { 
                    text: "❌ Request timeout. The TikTok API is taking too long to respond. Please try again."
                }, { quoted: message });
            } else if (error.response?.status === 404) {
                await sock.sendMessage(chatId, { 
                    text: "❌ TikTok video not found. The link might be invalid or the video was removed."
                }, { quoted: message });
            } else if (error.response?.status === 403) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Access forbidden. The TikTok API might be blocking the request."
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { 
                    text: "❌ Failed to fetch TikTok video. Please try again with a different link."
                }, { quoted: message });
            }
        }
    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ An unexpected error occurred. Please try again later."
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;
