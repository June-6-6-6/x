const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');
const fetch = require('node-fetch');

async function ytmp4Command(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🕖', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const url = parts.slice(1).join(' ').trim();

        if (!url) return await sock.sendMessage(chatId, { 
            text: '🎬 *YouTube MP4 Download Command*\n\nUsage:\n.ytmp4 <youtube_url>\n\nExample:\n.ytmp4 https://youtu.be/xxxx\n.ytmp4 https://www.youtube.com/watch?v=xxxx'
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            text: `⏬ Downloading MP4 video from: ${url}...`
        }, { quoted: message });

        // Search YouTube if URL is a search query
        let videoUrl = url;
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            const searchResult = await (await yts(`${url} video`)).videos[0];
            if (!searchResult) return sock.sendMessage(chatId, { 
                text: "😕 Couldn't find that video. Try another one!"
            }, { quoted: message });
            videoUrl = searchResult.url;
        }

        const apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch video!");
        }

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

        // Download MP4
        const videoResponse = await axios({ 
            method: "get", 
            url: apiData.result.downloadUrl, 
            responseType: "stream", 
            timeout: 600000 
        });
        const writer = fs.createWriteStream(filePath);
        videoResponse.data.pipe(writer);
        await new Promise((resolve, reject) => { 
            writer.on("finish", resolve); 
            writer.on("error", reject); 
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        await sock.sendMessage(chatId, { 
            video: { url: filePath },
            caption: `🎬 ${apiData.result.title || 'YouTube Video'}`,
            mimetype: "video/mp4"
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (error) {
        console.error("YTMP4 command error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

async function ytmp3Command(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🕖', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const url = parts.slice(1).join(' ').trim();

        if (!url) return await sock.sendMessage(chatId, { 
            text: '🎵 *YouTube MP3 Download Command*\n\nUsage:\n.ytmp3 <youtube_url>\n\nExample:\n.ytmp3 https://youtu.be/xxxx\n.ytmp3 https://www.youtube.com/watch?v=xxxx'
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            text: `⏬ Downloading MP3 audio from: ${url}...`
        }, { quoted: message });

        // Search YouTube if URL is a search query
        let videoUrl = url;
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            const searchResult = await (await yts(`${url}`)).videos[0];
            if (!searchResult) return sock.sendMessage(chatId, { 
                text: "😕 Couldn't find that video. Try another one!"
            }, { quoted: message });
            videoUrl = searchResult.url;
        }

        const apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch audio!");
        }

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

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
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${(apiData.result.title || 'audio').substring(0, 100)}.mp3`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (error) {
        console.error("YTMP3 command error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = {
    ytmp4Command,
    ytmp3Command
};
