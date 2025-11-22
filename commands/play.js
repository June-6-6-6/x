const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

async function playCommand(sock, chatId, message) {
    let filePath = null; // Track file path for cleanup
                
    try { 
        await sock.sendMessage(chatId, {
            react: { text: '🎼', key: message.key }
        });         
                    
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                    
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, { text: '🎵 Provide a song name!\nExample:.play Not Like Us'},{ quoted: message});

        if (query.length > 100) return await sock.sendMessage(chatId, { text: `📝 Song name too long! Max 100 chars.`},{ quoted: message});

        const searchResult = await yts(`${query} official`);
        if (!searchResult || !searchResult.videos || !searchResult.videos[0]) return sock.sendMessage(chatId, { text: "😕 Couldn't find that song. Try another one!"},{ quoted: message });

        const video = searchResult.videos[0];
        const apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        if (!apiData.status || !apiData.result || !apiData.result.downloadUrl) throw new Error("API failed to fetch track!");

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        filePath = path.join(tempDir, fileName);

        // Download MP3
        const audioResponse = await axios({ 
            method: "get", 
            url: apiData.result.downloadUrl, 
            responseType: "stream", 
            timeout: 600000 
        });
        
        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => { 
            writer.on("finish", resolve); 
            writer.on("error", reject);
            audioResponse.data.on("error", reject); // Added stream error handling
        });

        // Check if file exists and has content
        if (!fs.existsSync(filePath)) throw new Error("Download failed - file not created");
        const fileStats = fs.statSync(filePath);
        if (fileStats.size === 0) throw new Error("Download failed or empty file!");

        await sock.sendMessage(chatId, { text:`🎶Playing: _${apiData.result.title || video.title}_` }, { quoted: message });
        await sock.sendMessage(chatId, { 
            document: { url: `file://${filePath}` }, // Added file:// protocol
            mimetype: "audio/mpeg", 
            fileName: `${(apiData.result.title || video.title).substring(0, 100).replace(/[<>:"/\\|?*]/g, '')}.mp3` }, { quoted: message });

    } catch (error) {
        console.error("Play command error:", error);
        let errorMsg = `🚫 Error: ${error.message}`;
        
        // More specific error messages without changing flow
        if (error.code === 'ECONNABORTED') errorMsg = '🚫 Request timeout. Please try again.';
        else if (error.response?.status === 404) errorMsg = '🚫 Song not found or API unavailable.';
        else if (error.message.includes('download')) errorMsg = '🚫 Failed to download audio file.';
        
        return await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
    } finally {
        // Cleanup in finally block to ensure it runs
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (cleanupError) {
                console.error("Cleanup error:", cleanupError);
            }
        }
    }
}

module.exports = playCommand;
