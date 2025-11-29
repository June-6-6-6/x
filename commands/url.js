const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { TelegraPh } = require('../lib/uploader');

// helper: upload to Catbox
async function UploadFileCatbox(filePath) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", fs.createReadStream(filePath));

    const res = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders()
    });
    return res.data; // permanent URL
}

async function getMediaBufferAndExt(message) {
    const m = message.message || {};
    if (m.imageMessage) {
        const stream = await downloadContentFromMessage(m.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return { buffer: Buffer.concat(chunks), ext: '.jpg' };
    }
    if (m.videoMessage) {
        const stream = await downloadContentFromMessage(m.videoMessage, 'video');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return { buffer: Buffer.concat(chunks), ext: '.mp4' };
    }
    if (m.audioMessage) {
        const stream = await downloadContentFromMessage(m.audioMessage, 'audio');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return { buffer: Buffer.concat(chunks), ext: '.mp3' };
    }
    if (m.documentMessage) {
        const stream = await downloadContentFromMessage(m.documentMessage, 'document');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const fileName = m.documentMessage.fileName || 'file.bin';
        const ext = path.extname(fileName) || '.bin';
        return { buffer: Buffer.concat(chunks), ext };
    }
    if (m.stickerMessage) {
        const stream = await downloadContentFromMessage(m.stickerMessage, 'sticker');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return { buffer: Buffer.concat(chunks), ext: '.webp' };
    }
    return null;
}

async function getQuotedMediaBufferAndExt(message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
    if (!quoted) return null;
    return getMediaBufferAndExt({ message: quoted });
}

async function urlCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🖇️', key: message.key }
        });

        let media = await getMediaBufferAndExt(message);
        if (!media) media = await getQuotedMediaBufferAndExt(message);

        if (!media) {
            await sock.sendMessage(chatId, { text: 'Send or reply to a media (image, video, audio, sticker, document) to get a URL.' }, { quoted: message });
            return;
        }

        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const tempPath = path.join(tempDir, `${Date.now()}${media.ext}`);
        fs.writeFileSync(tempPath, media.buffer);

        let url = '';
        try {
            if (['.jpg', '.png', '.webp'].includes(media.ext)) {
                try {
                    url = await TelegraPh(tempPath);
                } catch {
                    url = await UploadFileCatbox(tempPath);
                }
            } else {
                url = await UploadFileCatbox(tempPath);
            }
        } finally {
            setTimeout(() => {
                try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
            }, 2000);
        }

        if (!url) {
            await sock.sendMessage(chatId, { text: 'Failed to upload media.' }, { quoted: message });
            return;
        }

        // ✅ Simple buttons (light Baileys)
        const buttons = [
            { buttonId: `copy_${Date.now()}`, buttonText: { displayText: "📋 Copy URL" }, type: 1 },
            { buttonId: `open_${Date.now()}`, buttonText: { displayText: "🌐 Open Link" }, type: 1 }
        ];

        const buttonMessage = {
            text: `Your Url:\n${url}`,
            footer: 'Choose an option below',
            buttons,
            headerType: 1
        };

        await sock.sendMessage(chatId, buttonMessage, { quoted: message });

    } catch (error) {
        console.error('[URL] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Failed to convert media to URL.' }, { quoted: message });
    }
}

module.exports = urlCommand;
