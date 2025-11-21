const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    let tempFile = null;
    
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();
        
        console.log('📥 Facebook Command - Input URL:', url);
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a Facebook video URL.\nExample: .fb https://www.facebook.com/..."
            }, { quoted: message });
        }

        // Validate Facebook URL - Fixed to include more Facebook URL patterns
        const facebookPatterns = [
            'facebook.com',
            'fb.watch',
            'fb.com',
            'facebook.com/watch/',
            'facebook.com/reel/',
            'facebook.com/story.php'
        ];
        
        const isFacebookUrl = facebookPatterns.some(pattern => url.includes(pattern));
        if (!isFacebookUrl) {
            return await sock.sendMessage(chatId, { 
                text: "❌ That is not a valid Facebook video URL.\n\nSupported formats:\n• facebook.com/.../videos/...\n• fb.watch/...\n• facebook.com/reel/...\n• facebook.com/watch/..."
            }, { quoted: message });
        }

        // Send loading reaction
        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        // Improved URL resolution
        let resolvedUrl = url;
        try {
            console.log('🔄 Resolving URL...');
            const res = await axios.get(url, { 
                timeout: 15000, 
                maxRedirects: 10, 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // Follow redirects
                }
            });
            
            // Get final URL after redirects
            resolvedUrl = res.request.res.responseUrl || url;
            console.log('✅ URL resolved to:', resolvedUrl);
        } catch (error) {
            console.log('⚠️ URL resolution failed, using original URL');
            resolvedUrl = url;
        }

        // Improved API function with better error handling
        async function fetchFromApi(apiUrl) {
            console.log('📡 Calling API:', apiUrl);
            
            try {
                const response = await axios.get(apiUrl, {
                    timeout: 25000,
                    headers: {
                        'accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.facebook.com/'
                    },
                    maxRedirects: 5,
                    validateStatus: (status) => status < 500 // Don't throw on 4xx errors
                });

                console.log('📊 API Response Status:', response.status);
                
                if (response.data) {
                    console.log('🔍 API Response Structure:', Object.keys(response.data));
                    
                    // Check if response contains video data
                    const hasVideoData = checkForVideoData(response.data);
                    if (hasVideoData) {
                        return { 
                            response, 
                            apiName: 'Hanggts API',
                            success: true
                        };
                    } else {
                        console.log('❌ API response missing video data');
                        throw new Error('No video data in API response');
                    }
                }
                throw new Error('Empty API response');
            } catch (error) {
                console.error('💥 API call failed:', error.message);
                if (error.response) {
                    console.error('API Response Status:', error.response.status);
                    console.error('API Response Data:', error.response.data);
                }
                throw error;
            }
        }

        // Helper function to check for video data
        function checkForVideoData(data) {
            if (!data) return false;
            
            const checks = [
                data.status === true,
                data.result?.media?.video_hd,
                data.result?.media?.video_sd,
                data.result?.url,
                data.data?.url,
                data.url,
                data.download,
                data.video,
                Array.isArray(data.data) && data.data.length > 0,
                typeof data.result === 'string' && data.result.startsWith('http')
            ];
            
            return checks.some(check => check === true);
        }

        // Improved video URL extraction
        function extractVideoUrl(data) {
            console.log('🎯 Extracting video URL from response...');
            
            if (!data) return null;

            // Try different response structures
            const extractionAttempts = [
                // Structure 1: Hanggts media format
                () => data.result?.media?.video_hd || data.result?.media?.video_sd || data.result?.media?.video,
                
                // Structure 2: Direct result URL
                () => data.result?.url,
                
                // Structure 3: Data object with URL
                () => data.data?.url,
                
                // Structure 4: Direct URLs
                () => data.url || data.download,
                
                // Structure 5: Video object
                () => (typeof data.video === 'string' ? data.video : data.video?.url),
                
                // Structure 6: Array data
                () => {
                    if (Array.isArray(data.data)) {
                        const hd = data.data.find(item => item.quality === 'HD' || item.quality === 'high');
                        const sd = data.data.find(item => item.quality === 'SD' || item.quality === 'low');
                        return (hd || sd || data.data[0])?.url;
                    }
                    return null;
                },
                
                // Structure 7: String result (direct URL)
                () => (typeof data.result === 'string' && data.result.startsWith('http') ? data.result : null),
                
                // Structure 8: Nested download
                () => data.result?.download || data.data?.download
            ];

            for (const attempt of extractionAttempts) {
                try {
                    const videoUrl = attempt();
                    if (videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
                        console.log('✅ Video URL found:', videoUrl);
                        return videoUrl;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            console.log('❌ No valid video URL found in response');
            return null;
        }

        // Extract title from response
        function extractTitle(data) {
            const titleSources = [
                data.result?.info?.title,
                data.result?.title,
                data.title,
                data.result?.caption,
                data.data?.title,
                data.video?.title
            ];
            
            return titleSources.find(title => title && typeof title === 'string') || "Facebook Video";
        }

        // Try API with resolved URL first, then original URL
        let apiResult;
        const apiUrl = `https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(resolvedUrl)}`;
        
        try {
            apiResult = await fetchFromApi(apiUrl);
        } catch (error) {
            console.log('🔄 Trying with original URL...');
            const fallbackApiUrl = `https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(url)}`;
            apiResult = await fetchFromApi(fallbackApiUrl);
        }

        const { response, apiName } = apiResult;
        const data = response.data;

        // Extract video URL and title
        const fbvid = extractVideoUrl(data);
        const title = extractTitle(data);

        if (!fbvid) {
            console.log('❌ Failed to extract video URL');
            return await sock.sendMessage(chatId, { 
                text: '❌ Failed to download Facebook video.\n\nPossible reasons:\n• Video is private or deleted\n• Link is invalid or not a video\n• Video is age-restricted\n• API is temporarily unavailable\n\nPlease try a different Facebook video link.'
            }, { quoted: message });
        }

        console.log('🎬 Video Details:', {
            url: fbvid,
            title: title,
            api: apiName
        });

        // Try URL method first
        try {
            console.log('🚀 Attempting URL method...');
            const caption = `JUNE X BOT\n\n📝 Title: ${title}\n🔧 Source: ${apiName}\n> 📌By Humans, For Humans !`;
            
            await sock.sendMessage(chatId, {
                video: { url: fbvid },
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: message });
            
            console.log('✅ Video sent successfully via URL method');
            return;
            
        } catch (urlError) {
            console.error('❌ URL method failed:', urlError.message);
            console.log('🔄 Falling back to buffer method...');

            // Fallback to buffer method
            try {
                // Create temp directory
                const tmpDir = path.join(process.cwd(), 'tmp');
                if (!fs.existsSync(tmpDir)) {
                    fs.mkdirSync(tmpDir, { recursive: true });
                }

                // Generate temp file path
                tempFile = path.join(tmpDir, `fb_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);

                console.log('📥 Downloading video to:', tempFile);
                
                // Download the video with better error handling
                const videoResponse = await axios({
                    method: 'GET',
                    url: fbvid,
                    responseType: 'stream',
                    timeout: 120000, // Increased timeout
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.facebook.com/',
                        'Range': 'bytes=0-'
                    },
                    maxRedirects: 5
                });

                // Check content type
                const contentType = videoResponse.headers['content-type'];
                if (!contentType || !contentType.includes('video')) {
                    console.warn('⚠️ Response may not be a video. Content-Type:', contentType);
                }

                const fileSize = parseInt(videoResponse.headers['content-length']) || 0;
                console.log(`📊 Download size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

                const writer = fs.createWriteStream(tempFile);
                videoResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    // Add timeout for download
                    setTimeout(() => reject(new Error('Download timeout')), 120000);
                });

                // Verify download
                if (!fs.existsSync(tempFile)) {
                    throw new Error('Downloaded file not found');
                }

                const stats = fs.statSync(tempFile);
                if (stats.size === 0) {
                    throw new Error('Downloaded file is empty');
                }

                console.log(`✅ Download completed: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

                // Send the video
                const caption = `JUNE X BOT\n\n📝 Title: ${title}\n🔧 Source: ${apiName}\n> 📌By Humans, For Humans`;
                
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(tempFile),
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });

                console.log('✅ Video sent successfully via buffer method');
                return;

            } catch (bufferError) {
                console.error('💥 Buffer method failed:', bufferError.message);
                throw new Error(`Both methods failed: ${bufferError.message}`);
            }
        }

    } catch (error) {
        console.error('💥 Facebook command error:', error);
        
        let errorMessage = "❌ Failed to download Facebook video. ";
        
        if (error.message.includes('timeout')) {
            errorMessage += "The request timed out. Please try again.";
        } else if (error.message.includes('Network Error')) {
            errorMessage += "Network error. Please check your connection.";
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
            errorMessage += "Video not found. The link may be invalid or the video was removed.";
        } else if (error.message.includes('API')) {
            errorMessage += "Download service is temporarily unavailable.";
        } else {
            errorMessage += `Error: ${error.message}`;
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage
        }, { quoted: message });
        
    } finally {
        // Clean up temp file
        if (tempFile && fs.existsSync(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
                console.log('🧹 Temp file cleaned up');
            } catch (cleanupError) {
                console.error('Failed to cleanup temp file:', cleanupError);
            }
        }
    }
}

module.exports = facebookCommand;
