const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function viewonceCommand(sock, chatId, message) {
    // Extract quoted message
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    // Get sender JID (user.id)
    const senderId = sock.user.id;

    // Helper to download media
    async function downloadMedia(msg, type) {
        const stream = await downloadContentFromMessage(msg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return buffer;
    }

    if (quotedImage && quotedImage.viewOnce) {
        const buffer = await downloadMedia(quotedImage, 'image');
        const caption = quotedImage.caption || '';

        // Send privately to sender
        if (senderId) {
            await sock.sendMessage(senderId, { image: buffer, fileName: 'media.jpg', caption }, { quoted: message });
        }

        // Send anti-viewonce in public chat
        await sock.sendMessage(chatId, { image: buffer, fileName: 'media.jpg', caption }, { quoted: message });

    } else if (quotedVideo && quotedVideo.viewOnce) {
        const buffer = await downloadMedia(quotedVideo, 'video');
        const caption = quotedVideo.caption || '';

        // Send privately to sender
        if (senderId) {
            await sock.sendMessage(senderId, { video: buffer, fileName: 'media.mp4', caption }, { quoted: message });
        }

        // Send anti-viewonce in public chat
        await sock.sendMessage(chatId, { video: buffer, fileName: 'media.mp4', caption }, { quoted: message });

    } else {
        await sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image or video.' }, { quoted: message });
    }
}

module.exports = viewonceCommand;
