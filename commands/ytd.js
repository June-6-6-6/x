const fs = require("fs");
const axios = require('axios');

// Helper to send usage message
async function sendUsage(sock, chatId, type) {
    const usage = type === "mp4"
        ? `🎬 *YouTube MP4 Download Command*\n\nUsage:\n.ytmp4 <youtube_url>\n\nExample:\n.ytmp4 https://youtu.be/xxxx`
        : `🎵 *YouTube MP3 Download Command*\n\nUsage:\n.ytmp3 <youtube_url>\n\nExample:\n.ytmp3 https://youtu.be/xxxx`;
    await sock.sendMessage(chatId, { text: usage });
}

// Common starter (reaction + info)
async function startDownload(sock, chatId, message, url, type) {
    await sock.sendMessage(chatId, { react: { text: '🕖', key: message.key } });
    await sock.sendMessage(chatId, { text: `⏬ Downloading ${type.toUpperCase()} from: ${url}...` }, { quoted: message });
}

// MP4 Command
async function ytmp4Command(sock, chatId, senderId, message, userMessage) {
    const url = userMessage.split(' ')[1];
    if (!url) return sendUsage(sock, chatId, "mp4");

    try {
        await startDownload(sock, chatId, message, url, "mp4");
        const mp4dl = await ytmp4(url, { format: "mp4", videoQuality: "720" });

        if (!mp4dl?.url) throw new Error("Invalid video response");

        const videoBuffer = await (await fetch(mp4dl.url)).arrayBuffer();
        await sock.sendMessage(chatId, {
            video: Buffer.from(videoBuffer),
            caption: `🎬 ${mp4dl.filename || 'YouTube Video'}`,
            mimetype: "video/mp4"
        }, { quoted: message });

    } catch (err) {
        console.error("MP4 error:", err);
        await sock.sendMessage(chatId, { text: '❌ Error downloading the video.' });
    }
}

// MP3 Command
async function ytmp3Command(sock, chatId, senderId, message, userMessage) {
    const url = userMessage.split(' ')[1];
    if (!url) return sendUsage(sock, chatId, "mp3");

    try {
        await startDownload(sock, chatId, message, url, "mp3");
        const apiUrl = `https://apis-sandarux.zone.id/api/ytmp3/ytdown?url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(apiUrl);

        const dlLink = data?.result?.download_url 
            || data?.result?.media?.find(m => m.Type === "audio" && m.format === "mp3")?.download_link;

        if (!dlLink) throw new Error("No audio link");

        await sock.sendMessage(chatId, {
            document: { url: dlLink },
            mimetype: "audio/mpeg",
            fileName: `${data.result.title || 'audio'}.mp3`,
            contextInfo: {
                externalAdReply: {
                    thumbnailUrl: data.result.thumbnail,
                    title: data.result.title || "YouTube Audio",
                    body: "Downloaded via YouTube MP3",
                    sourceUrl: url,
                    renderLargerThumbnail: true,
                    mediaType: 1,
                    forwardingScore: 9999999,
                    isForwarded: true,
                }
            }
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error("MP3 error:", err);
        await sock.sendMessage(chatId, { text: '❌ Error downloading the audio.' });
    }
}

module.exports = { ytmp4Command, ytmp3Command };
