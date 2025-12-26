const axios = require('axios');

async function ytmp4Command(sock, chatId, senderId, message, userMessage) {
    const url = userMessage.split(' ')[1];
    if (!url) {
        return sock.sendMessage(chatId, {
            text: `🎬 *YouTube MP4 Download*\nUsage:\n.ytmp4 <youtube_url>`
        });
    }

    await sock.sendMessage(chatId, { react: { text: '🕖', key: message.key } });
    await sock.sendMessage(chatId, { text: `⏬ Downloading MP4 from: ${url}...` }, { quoted: message });

    try {
        const mp4dl = await ytmp4(url, { format: "mp4", videoQuality: "720" });
        if (!mp4dl?.url) throw new Error("No video URL");

        const videoBuffer = await (await fetch(mp4dl.url)).arrayBuffer();
        await sock.sendMessage(chatId, {
            video: Buffer.from(videoBuffer),
            caption: `🎬 ${mp4dl.filename || 'YouTube Video'}`,
            mimetype: "video/mp4"
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to download video.' });
    }
}

async function ytmp3Command(sock, chatId, senderId, message, userMessage) {
    const url = userMessage.split(' ')[1];
    if (!url) {
        return sock.sendMessage(chatId, {
            text: `🎵 *YouTube MP3 Download*\nUsage:\n.ytmp3 <youtube_url>`
        });
    }

    await sock.sendMessage(chatId, { react: { text: '🕖', key: message.key } });
    await sock.sendMessage(chatId, { text: `⏬ Downloading MP3 from: ${url}...` }, { quoted: message });

    try {
        const { data } = await axios.get(`https://apis-sandarux.zone.id/api/ytmp3/ytdown?url=${encodeURIComponent(url)}`);
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
                    mediaType: 1
                }
            }
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to download audio.' });
    }
}

module.exports = { ytmp4Command, ytmp3Command };
