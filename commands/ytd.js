const axios = require('axios');

async function ytmp4Command(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args[0];

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `🎬 *YouTube MP4 Download Command*\n\nUsage:\n.ytmp4 <youtube_url>\n\nExample:\n.ytmp4 https://youtu.be/xxxx\n.ytmp4 https://www.youtube.com/watch?v=xxxx`
            });
        }

        await sock.sendMessage(chatId, { 
            react: { text: '🕖', key: message.key } 
        });

        await sock.sendMessage(chatId, {
            text: `⏬ Downloading MP4 video from: ${url}...`
        }, { quoted: message });

        try {
            const mp4dl = await ytmp4(url, {
                format: "mp4",
                videoQuality: "720"
            });

            if (!mp4dl || !mp4dl.url) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Failed to get the video. Please check the URL and try again.'
                });
            }

            const videoBuffer = await (await fetch(mp4dl.url)).arrayBuffer();

            await sock.sendMessage(chatId, {
                video: Buffer.from(videoBuffer),
                caption: `🎬 ${mp4dl.filename || 'YouTube Video'}`,
                mimetype: "video/mp4"
            }, { quoted: message });

        } catch (downloadError) {
            console.error('MP4 download error:', downloadError);
            return await sock.sendMessage(chatId, {
                text: '❌ Error downloading the video. Please check the URL and try again.'
            });
        }

    } catch (error) {
        console.error('YouTube MP4 command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred while downloading the video. Please try again.'
        });
    }
}

async function ytmp3Command(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args[0];

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `🎵 *YouTube MP3 Download Command*\n\nUsage:\n.ytmp3 <youtube_url>\n\nExample:\n.ytmp3 https://youtu.be/xxxx\n.ytmp3 https://www.youtube.com/watch?v=xxxx`
            });
        }

        await sock.sendMessage(chatId, { 
            react: { text: '🕖', key: message.key } 
        });

        await sock.sendMessage(chatId, {
            text: `⏬ Downloading mp3 ${url}...`
        }, { quoted: message });

        try {
            const apiUrl = `https://iamtkm.vercel.app/downloaders/ytmp3?apikey=tkm&url=${encodeURIComponent(url)}`;
            const data = await axios.get(apiUrl);

            if (!data.status) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Failed to fetch audio from API.'
                });
            }

            const dlLink = data.data.url && data.data.format === 'mp3';
                
            if (!dlLink) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Audio download link not found.'
                });
            }

            await sock.sendMessage(
                chatId,
                {
                    document: { url: dlLink },
                    mimetype: "audio/mpeg",
                    fileName: `${data.data.title || 'audio'}.mp3`,
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
                },
                { quoted: message }
            );

            await sock.sendMessage(chatId, { 
                react: { text: '✅', key: message.key } 
            });

        } catch (apiError) {
            console.error('API error:', apiError);
            return await sock.sendMessage(chatId, {
                text: '❌ Failed to fetch the song. Please try again later.'
            });
        }

    } catch (error) {
        console.error('YouTube MP3 command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred while downloading the audio. Please try again.'
        });
    }
}

module.exports = {
    ytmp4Command,
    ytmp3Command
};
