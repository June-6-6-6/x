
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

/**
 * Utility: Convert a stream into a Buffer
 */
async function streamToBuffer(stream) {
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

/**
 * Command: Handle view-once media (image/video)
 */
async function viewonceCommand(sock, chatId, message) {
    try {
        const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return sock.sendMessage(chatId, { text: '❌ No quoted message found.' }, { quoted: message });
        }

        const quotedImage = quoted.imageMessage;
        const quotedVideo = quoted.videoMessage;

        if (quotedImage?.viewOnce) {
            // Download and send the image
            const stream = await downloadContentFromMessage(quotedImage, 'image');
            const buffer = await streamToBuffer(stream);

            await sock.sendMessage(
                chatId,
                {
                    image: buffer,
                    fileName: 'media.jpg',
                    caption: quotedImage.caption || '*🤴 Retrived by June-X Bot*'
                },
                { quoted: message }
            );
        } else if (quotedVideo?.viewOnce) {
            // Download and send the video
            const stream = await downloadContentFromMessage(quotedVideo, 'video');
            const buffer = await streamToBuffer(stream);

            await sock.sendMessage(
                chatId,
                {
                    video: buffer,
                    fileName: 'media.mp4',
                    caption: quotedVideo.caption || ''
                },
                { quoted: message }
            );
        } else {
            await sock.sendMessage(
                chatId,
                { text: '❌ Please reply to a view-once image or video.' },
                { quoted: message }
            );
        }
    } catch (err) {
        console.error('Error in viewonceCommand:', err);
        await sock.sendMessage(
            chatId,
            { text: '⚠️ Failed to process view-once media. Try again.' },
            { quoted: message }
        );
    }
}

module.exports = viewonceCommand;
