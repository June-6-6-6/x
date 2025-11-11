const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function viewonceCommand(sock, chatId, message) {
    // Extract quoted imageMessage or videoMessage
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    // Get sender's user ID (for private sending)
    const senderId = message.key?.participant || message.key?.remoteJid;

    if (quotedImage && quotedImage.viewOnce) {
        // Download and send the image privately
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(senderId, { 
            image: buffer, 
            fileName: 'media.jpg', 
            caption: quotedImage.caption || '' 
        });
    } else if (quotedVideo && quotedVideo.viewOnce) {
        // Download and send the video privately
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(senderId, { 
            video: buffer, 
            fileName: 'media.mp4', 
            caption: quotedVideo.caption || '' 
        });
    } else {
        // Notify in private if not a view-once media
        await sock.sendMessage(senderId, { text: '❌ Please reply to a view-once image or video.' });
    }
}

module.exports = viewonceCommand;
