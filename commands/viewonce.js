const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function viewonceCommand(sock, chatId, message) {
    // Extract quoted imageMessage or videoMessage
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    if (quotedImage && quotedImage.viewOnce) {
        // Download and send the image
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(
            chatId,
            {
                image: buffer,
                fileName: 'media.jpg',
                caption: quotedImage.caption || '',
                footer: '🟢 RETRIEVED BY JUNE-X BOT\n📌 By Humans, For Humans!'
            },
            { quoted: message }
        );

        // Delete the command message
        await sock.sendMessage(chatId, { delete: message.key });

    } else if (quotedVideo && quotedVideo.viewOnce) {
        // Download and send the video
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(
            chatId,
            {
                video: buffer,
                fileName: 'media.mp4',
                caption: quotedVideo.caption || '',
                footer: '🟢 RETRIEVED BY JUNE-X BOT\n📌 By Humans, For Humans!'
            },
            { quoted: message }
        );

        // Delete the command message
        await sock.sendMessage(chatId, { delete: message.key });

    } else {
        await sock.sendMessage(
            chatId,
            { text: '❌ Please reply to a view-once image or video.' },
            { quoted: message }
        );
    }
}

module.exports = viewonceCommand;
