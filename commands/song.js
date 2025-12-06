
// new song API with all endpoints
const yts = require('yt-search');
const axios = require('axios');

async function songCommand(sock, chatId, message) {
    try {
        // Initial reaction 🎵
        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const args = text.split(' ');
        const command = args[0].toLowerCase(); // e.g. .song, .video, .playlist
        const searchQuery = args.slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What song/video/playlist do you want to download?" 
            }, { quoted: message });
        }

        // Search YouTube
        const { videos, playlists } = await yts(searchQuery);
        if ((!videos || videos.length === 0) && (!playlists || playlists.length === 0)) {
            return await sock.sendMessage(chatId, { text: "No results found!" });
        }

        let apiUrl, title, downloadUrl;

        if (command === ".song") {
            // MP3 endpoint
            const video = videos[0];
            apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp3?url=${video.url}`;
        } else if (command === ".video") {
            // MP4 endpoint
            const video = videos[0];
            apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp4?url=${video.url}`;
        } else if (command === ".playlist") {
            // Playlist endpoint
            const playlist = playlists[0];
            apiUrl = `https://api.privatezia.biz.id/api/downloader/ytplaylist?url=${playlist.url}`;
        } else if (command === ".search") {
            // Direct search endpoint
            apiUrl = `https://api.privatezia.biz.id/api/downloader/ytsearch?query=${encodeURIComponent(searchQuery)}`;
        } else {
            return await sock.sendMessage(chatId, { 
                text: "Unknown command. Use .song, .video, .playlist, or .search" 
            }, { quoted: message });
        }

        // Fetch data from API
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData || !apiData.status || !apiData.result) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to fetch data from API. Please try again later." 
            }, { quoted: message });
        }

        // Handle different endpoints
        if (command === ".song") {
            title = apiData.result.title;
            downloadUrl = apiData.result.downloadUrl;

            await sock.sendMessage(chatId, { text: `_🎶 Playing song: *${title}* 🎧_` }, { quoted: message });
            await sock.sendMessage(chatId, {
                audio: { url: downloadUrl },
                mimetype: "audio/mpeg",
                fileName: `${title}.mp3`
            }, { quoted: message });

        } else if (command === ".video") {
            title = apiData.result.title;
            downloadUrl = apiData.result.downloadUrl;

            await sock.sendMessage(chatId, { text: `_📺 Downloading video: *${title}* 🎬_` }, { quoted: message });
            await sock.sendMessage(chatId, {
                video: { url: downloadUrl },
                mimetype: "video/mp4",
                fileName: `${title}.mp4`
            }, { quoted: message });

        } else if (command === ".playlist") {
            title = apiData.result.title;
            const items = apiData.result.items || [];

            await sock.sendMessage(chatId, { 
                text: `_📂 Playlist: *${title}* (${items.length} items)_` 
            }, { quoted: message });

            for (const item of items.slice(0, 5)) { // limit to 5 for UX
                await sock.sendMessage(chatId, { 
                    text: `🎶 ${item.title}\n🔗 ${item.url}` 
                }, { quoted: message });
            }

        } else if (command === ".search") {
            const results = apiData.result || [];
            await sock.sendMessage(chatId, { 
                text: `_🔍 Search results for: *${searchQuery}*_\n\n` +
                      results.slice(0, 5).map(r => `🎶 ${r.title}\n🔗 ${r.url}`).join("\n\n")
            }, { quoted: message });
        }

        // Success reaction 💅
        await sock.sendMessage(chatId, { react: { text: '💅', key: message.key } });

    } catch (error) {
        console.error('Error in songCommand:', error);
        await sock.sendMessage(chatId, { text: "Download failed. Please try again later." });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = songCommand;
