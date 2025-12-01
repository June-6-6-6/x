const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // or 'baileys'

async function saveStatusCommand(sock, chatId, message) {
    try {
        // ✅ Owner-only check
        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '😡 Command only for the owner.' });
        }

        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) {
            await sock.sendMessage(chatId, { text: '⚠️ Please reply to a status update to save it.' });
            return sock.sendMessage(chatId, { react: { text: '🗑️', key: message.key } });
        }

        let statusMedia, mediaType;

        // ✅ Handle text status
        if (quotedMsg.extendedTextMessage?.text) {
            const text = quotedMsg.extendedTextMessage.text;
            await sock.sendMessage(chatId, { text: `📝 *Saved Status Text*\n\n${text}\n\n✅ Status text saved successfully!` });
            return sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });
        }

        // ✅ Handle image/video status
        if (quotedMsg.imageMessage) {
            statusMedia = quotedMsg.imageMessage;
            mediaType = 'image';
        } else if (quotedMsg.videoMessage) {
            statusMedia = quotedMsg.videoMessage;
            mediaType = 'video';
        } else {
            await sock.sendMessage(chatId, { text: '❌ The replied message is not a valid status update.' });
            return sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

        // ⏳ Reaction: downloading
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
        await sock.sendMessage(chatId, { text: '📥 Downloading status...' });

        // ✅ Download media
        const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            'buffer',
            {},
            { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
        );

        // ✅ Save to local folder
        const dirPath = path.join(__dirname, '..', 'saved_statuses');
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

        const filename = `status_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
        const filepath = path.join(dirPath, filename);

        fs.writeFileSync(filepath, buffer);

        // 🎉 Send back confirmation + media
        await sock.sendMessage(chatId, {
            [mediaType]: buffer,
            caption: `✅ Status ${mediaType} saved successfully!\n📁 Saved as: ${filename}`
        });

        // 🎯 Final reaction: success
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('⚠️ Error in saveStatusCommand:', error);
        await sock.sendMessage(chatId, { text: `🉐 Failed to save status. Error: ${error.message}` });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = saveStatusCommand;
