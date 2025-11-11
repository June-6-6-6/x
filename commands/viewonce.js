const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function viewonceCommand(sock, chatId, message, command) {
    // Extract quoted imageMessage or videoMessage from your structure
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    // Determine destination based on command
    // If command is .vv, send to bot's inbox, otherwise send to current chat
    const sendToInbox = command === '.vv';

    if (quotedImage && quotedImage.viewOnce) {
        try {
            // Download the image
            const stream = await downloadContentFromMessage(quotedImage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            
            if (sendToInbox) {
                // Send to the bot's own user ID (inbox)
                const botId = sock.user.id;
                await sock.sendMessage(botId, { 
                    image: buffer, 
                    fileName: 'media.jpg', 
                    caption: quotedImage.caption || 'Downloaded view-once image'
                });
                
                // Send confirmation to original chat
                await sock.sendMessage(chatId, { 
                    text: '✅ View-once image has been downloaded and sent to my inbox.' 
                }, { quoted: message });
            } else {
                // Send to the original chat
                await sock.sendMessage(chatId, { 
                    image: buffer, 
                    fileName: 'media.jpg', 
                    caption: quotedImage.caption || '' 
                }, { quoted: message });
            }
            
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
            
            if (sendToInbox) {
                // Send to the bot's own user ID (inbox)
                const botId = sock.user.id;
                await sock.sendMessage(botId, { 
                    video: buffer, 
                    fileName: 'media.mp4', 
                    caption: quotedVideo.caption || 'Downloaded view-once video'
                });
                
                // Send confirmation to original chat
                await sock.sendMessage(chatId, { 
                    text: '✅ View-once video has been downloaded and sent to my inbox.' 
                }, { quoted: message });
            } else {
                // Send to the original chat
                await sock.sendMessage(chatId, { 
                    video: buffer, 
                    fileName: 'media.mp4', 
                    caption: quotedVideo.caption || '' 
                }, { quoted: message });
            }
            
        } catch (error) {
            console.error('Error downloading view-once video:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download the view-once video.' 
            }, { quoted: message });
        }
    } else {
        const helpText = `❌ Please reply to a view-once image or video.

Commands:
• Use the main command to reveal view-once in this chat
• Use .vv command to download and send to my inbox`;
        
        await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
    }
}

module.exports = viewonceCommand;
