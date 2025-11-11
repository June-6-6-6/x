const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function viewonceCommand(sock, chatId, message) {
    // Extract quoted imageMessage or videoMessage from your structure
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    if (quotedImage && quotedImage.viewOnce) {
        try {
            // Download the image
            const stream = await downloadContentFromMessage(quotedImage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            
            // Send to the bot's own user ID
            const botId = sock.user.id;
            await sock.sendMessage(botId, { 
                image: buffer, 
                fileName: 'media.jpg', 
                caption: quotedImage.caption || '' 
            });
            
            // Also send confirmation to the original chat
            await sock.sendMessage(chatId, { 
                text: '✅ View-once image has been downloaded and sent to my inbox.' 
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error downloading view-once image:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download the view-once image.' 
            }, { quoted: message });
        }
    } else if (quotedVideo && quotedVideo.viewOnce) {
        try {
            // Download the video
            const stream = await downloadContentFromMessage(quotedVideo, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            
            // Send to the bot's own user ID
            const botId = sock.user.id;
            await sock.sendMessage(botId, { 
                video: buffer, 
                fileName: 'media.mp4', 
                caption: quotedVideo.caption || '' 
            });
            
            // Also send confirmation to the original chat
            await sock.sendMessage(chatId, { 
                text: '✅ View-once video has been downloaded and sent to my inbox.' 
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error downloading view-once video:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download the view-once video.' 
            }, { quoted: message });
        }
    } else {
        await sock.sendMessage(chatId, { 
            text: '❌ Please reply to a view-once image or video.' 
        }, { quoted: message });
    }
}

module.exports = viewonceCommand;
