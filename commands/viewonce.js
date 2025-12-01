const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function vvCommand(sock, chatId, message) {
    // Extract quoted message from your structure
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;
    const quotedAudio = quoted?.audioMessage;

    if (!quoted) {
        await sock.sendMessage(chatId, { text: '📌 Reply to a media message to retrieve it.' }, { quoted: message });
        return;
    }

    try {
        if (quotedImage) {
            // Download and send the image
            const stream = await downloadContentFromMessage(quotedImage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(chatId, { 
                image: buffer, 
                fileName: 'image.jpg', 
                caption: quotedImage.caption || '' 
            }, { quoted: message });
        } 
        else if (quotedVideo) {
            // Download and send the video
            const stream = await downloadContentFromMessage(quotedVideo, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(chatId, { 
                video: buffer, 
                fileName: 'video.mp4', 
                caption: quotedVideo.caption || '' 
            }, { quoted: message });
        } 
        else if (quotedAudio) {
            // Download and send the audio
            const stream = await downloadContentFromMessage(quotedAudio, 'audio');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(chatId, { 
                audio: buffer, 
                fileName: 'audio.mp3', 
                mimetype: 'audio/mpeg' 
            }, { quoted: message });
        } 
        else {
            await sock.sendMessage(chatId, { text: '❌ The quoted message is not a supported media type (image, video, or audio).' }, { quoted: message });
        }
    } catch (err) {
        console.error("vv command error:", err);
        await sock.sendMessage(chatId, { text: '❌ Failed to retrieve media. Try again.' }, { quoted: message });
    }
}

module.exports = vvCommand;
