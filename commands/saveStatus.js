const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function saveStatusCommand(sock, chatId, message) {
    try {
        // Owner-only check
        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '😡 Command only for the owner.' });
        }

        const quotedInfo = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = quotedInfo?.quotedMessage;

        if (!quotedMsg) {
            await sock.sendMessage(chatId, { text: '⚠️ Please reply to a status update to save it.' });
            return sock.sendMessage(chatId, { react: { text: '📑', key: message.key } });
        }

        // Check if the quoted message is from a status broadcast (status@broadcast)
        if (quotedInfo?.participant !== 'status@broadcast') {
            await sock.sendMessage(chatId, { 
                text: '❌ This command only works on status updates. Please reply to a status.'
            });
            return sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

        console.log('🔍 Quoted message from status update');

        // Handle text status (no caption removal for text)
        if (quotedMsg.extendedTextMessage?.text) {
            const text = quotedMsg.extendedTextMessage.text;
            console.log('📝 Detected text status:', text);
            await sock.sendMessage(chatId, { 
                text: `📝 *Saved Status Text*\n\n${text}\n\n✅ Status text saved successfully!` 
            });
            return sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });
        }

        let mediaType, extension;
        if (quotedMsg.imageMessage) {
            mediaType = 'image';
            extension = 'jpg';
        } else if (quotedMsg.videoMessage) {
            mediaType = 'video';
            extension = 'mp4';
        } else if (quotedMsg.audioMessage) {
            mediaType = 'audio';
            extension = 'ogg';
        } else {
            console.log('❌ Unsupported quotedMsg type:', Object.keys(quotedMsg));
            await sock.sendMessage(chatId, { text: '❌ The replied message is not a valid status update.' });
            return sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

        console.log(`📌 Detected mediaType: ${mediaType}, extension: ${extension}`);

        // ⏳ Reaction: downloading
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
        await sock.sendMessage(chatId, { text: '📥 Downloading status Update...' });

        // Download media
        const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            'buffer',
            {},
            { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
        );

        console.log(`✅ Downloaded buffer length: ${buffer.length}`);

        const dirPath = path.join(__dirname, '..', 'data', 'statuses');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log('📂 Created directory:', dirPath);
        }

        const filename = `status_${Date.now()}.${extension}`;
        const filepath = path.join(dirPath, filename);

        fs.writeFileSync(filepath, buffer);
        console.log('💾 Saved file at:', filepath);

        // Send media without caption
        const mediaMessage = {
            [mediaType]: buffer
            // No caption property added
        };
        
        await sock.sendMessage(chatId, mediaMessage);

        // 🎯 Final reaction: success
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('⚠️ Error in saveStatusCommand:', error);
        await sock.sendMessage(chatId, { text: `🉐 Failed to save status. Error: ${error?.stack || error}` });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = saveStatusCommand;
