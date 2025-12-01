const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // or 'baileys' depending on your package

async function saveStatusCommand(sock, chatId, message) {
    try {
        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, { text: '😡 Command only for the owner.' });
        }

        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) {
            await sock.sendMessage(chatId, { text: '⚠️ Please reply to a status update to save it.' });
            return sock.sendMessage(chatId, { react: { text: '🗑️', key: message.key } });
        }

        let statusMedia, mediaType;

        if (quotedMsg.extendedTextMessage?.text) {
            const text = quotedMsg.extendedTextMessage.text;
            await sock.sendMessage(chatId, { text: `📝 *Saved Status Text*\n\n${text}\n\n✅ Status text saved successfully!` });
            return sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });
        }

        if (quotedMsg.imageMessage) {
            statusMedia = quotedMsg.imageMessage;
            mediaType = 'image';
        } else if (quotedMsg.videoMessage) {
            statusMedia = quotedMsg.videoMessage;
            mediaType = 'video';
        } else {
            return sock.sendMessage(chatId, { text: '❌ The replied message is not a valid status update.' });
        }

        await sock.sendMessage(chatId, { text: '📥 Downloading status...' });

        // ✅ Use Baileys utility function
        const buffer = await downloadMediaMessage(
            { message: quotedMsg }, // pass the whole quoted message wrapper
            'buffer',
            {},
            { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
        );

        const dirPath = path.join(__dirname, '..', 'saved_statuses');
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

        const filename = `status_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
        const filepath = path.join(dirPath, filename);

        fs.writeFileSync(filepath, buffer);

        await sock.sendMessage(chatId, {
            [mediaType]: buffer,
            caption: `✅ Status ${mediaType} saved successfully!\n📁 Saved as: ${filename}`
        });

        await sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });

    } catch (error) {
        console.error('⚠️ Error in saveStatusCommand:', error);
        await sock.sendMessage(chatId, { text: `🉐 Failed to save status. Error: ${error.message}` });
    }
}

module.exports = saveStatusCommand;
