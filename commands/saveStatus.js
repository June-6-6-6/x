const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function saveStatusCommand(sock, chatId, message) {
    try {


        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) {
            await sock.sendMessage(chatId, { text: '⚠️ Please reply to a status update to save it.' });
            return await sock.sendMessage(chatId, { react: { text: '🗑️', key: message.key } });
        }

        let statusMedia, mediaType;

        // ✅ Handle text status
        if (quotedMsg.extendedTextMessage?.text) {
            const text = quotedMsg.extendedTextMessage.text;
            await sock.sendMessage(chatId, { 
                text: `📝 *Saved Status Text*\n\n${text}\n\n✅ Status text saved successfully!` 
            });
            return await sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });
        }

        // ✅ Handle image/video/audio status
        if (quotedMsg.imageMessage) {
            statusMedia = quotedMsg.imageMessage;
            mediaType = 'image';
        } else if (quotedMsg.videoMessage) {
            statusMedia = quotedMsg.videoMessage;
            mediaType = 'video';
        } else if (quotedMsg.audioMessage) {
            statusMedia = quotedMsg.audioMessage;
            mediaType = 'audio';
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ The replied message is not a valid status update.' 
            });
            return await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

        // ⏳ Reaction: downloading
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
        await sock.sendMessage(chatId, { text: '📥 Downloading status...' });

        // ✅ Download media with error handling
        let buffer;
        try {
            buffer = await downloadMediaMessage(
                { 
                    key: message.key, 
                    message: { ...quotedMsg } 
                },
                'buffer',
                {},
                { 
                    logger: sock.logger, 
                    reuploadRequest: sock.updateMediaMessage 
                }
            );
        } catch (downloadError) {
            console.error('Download error:', downloadError);
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download media. The status might have expired or is inaccessible.' 
            });
            return await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

        if (!buffer || buffer.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ Downloaded media is empty or invalid.' 
            });
            return await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

        // ✅ Save to local folder
        const dirPath = path.join(__dirname, '..', 'saved_statuses');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Determine file extension
        let extension = 'bin';
        const mimeType = statusMedia.mimetype || '';
        
        if (mediaType === 'image') {
            extension = mimeType.includes('png') ? 'png' : 'jpg';
        } else if (mediaType === 'video') {
            extension = mimeType.includes('gif') ? 'gif' : 'mp4';
        } else if (mediaType === 'audio') {
            // WhatsApp status audio can be opus (ogg) or mp3
            extension = mimeType.includes('ogg') || mimeType.includes('opus') ? 'ogg' : 'mp3';
        }

        const filename = `status_${Date.now()}.${extension}`;
        const filepath = path.join(dirPath, filename);

        fs.writeFileSync(filepath, buffer);

        // 🎉 Send back confirmation + media
        const mediaMessage = {
            caption: `✅ Status ${mediaType} saved successfully!\n📁 Saved as: ${filename}`
        };

        // Add the correct media property based on type
        if (mediaType === 'image') {
            mediaMessage.image = buffer;
        } else if (mediaType === 'video') {
            mediaMessage.video = buffer;
        } else if (mediaType === 'audio') {
            mediaMessage.audio = buffer;
            // Set mimetype for audio
            mediaMessage.mimetype = mimeType || 'audio/ogg; codecs=opus';
        }

        await sock.sendMessage(chatId, mediaMessage);

        // 🎯 Final reaction: success
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('⚠️ Error in saveStatusCommand:', error);
        
        // Send error message with fallback if message.key is undefined
        const errorText = `🉐 Failed to save status. Error: ${error.message}`;
        await sock.sendMessage(chatId, { text: errorText });
        
        // Only send reaction if we have a valid key
        if (message?.key) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }
    }
}

module.exports = saveStatusCommand;
