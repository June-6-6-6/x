const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

/**
 * Save WhatsApp Status (text, image, video, audio)
 * @param {object} sock - Baileys socket instance
 * @param {string} chatId - Chat ID
 * @param {object} message - Incoming message object
 */
async function saveStatusCommand(sock, chatId, message) {
    try {
        // ✅ Extract quoted message + key
        const quotedMsg = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedKey = message?.message?.extendedTextMessage?.contextInfo?.stanzaId;

        if (!quotedMsg) {
            await sock.sendMessage(chatId, { text: '⚠️ Please reply to a status update to save it.' });
            return sock.sendMessage(chatId, { react: { text: '🗑️', key: message.key } });
        }

        let mediaType, statusMedia;

        // ✅ Handle text statuses
        if (quotedMsg?.extendedTextMessage?.text) {
            const text = quotedMsg.extendedTextMessage.text;
            await sock.sendMessage(chatId, { text: `📝 *Saved Status Text*\n\n${text}\n\n✅ Status text saved successfully!` });
            return sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });
        }

        // ✅ Handle image, video, audio statuses
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
            return sock.sendMessage(chatId, { text: '❌ The replied message is not a valid status update.' });
        }

        await sock.sendMessage(chatId, { text: '📥 Downloading status...' });

        // ✅ Download media buffer
        const buffer = await downloadMediaMessage(
            { message: quotedMsg, key: { id: quotedKey } },
            'buffer',
            {},
            { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
        );

        // ✅ Ensure directory exists
        const dirPath = path.join(__dirname, '..', 'data', 'statuses');
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

        // ✅ Choose correct file extension
        let extension = 'bin';
        if (mediaType === 'image') extension = 'jpg';
        else if (mediaType === 'video') extension = 'mp4';
        else if (mediaType === 'audio') extension = 'mp3'; // WhatsApp audio is usually opus/ogg, but mp3 works

        const filename = `status_${Date.now()}.${extension}`;
        const filepath = path.join(dirPath, filename);

        fs.writeFileSync(filepath, buffer);

        // ✅ Send back the saved media
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
