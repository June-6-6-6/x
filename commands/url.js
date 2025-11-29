const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { TelegraPh } = require('../lib/uploader');

// =======================
// Helpers
// =======================

// Upload to Catbox (permanent for any file)
async function uploadToCatbox(filePath) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", fs.createReadStream(filePath));

    const res = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders()
    });

    return res.data; // permanent URL
}

// Extract buffer + extension from different media types
async function extractMedia(message) {
    const m = message.message || {};

    const handlers = {
        imageMessage: { type: 'image', ext: '.jpg' },
        videoMessage: { type: 'video', ext: '.mp4' },
        audioMessage: { type: 'audio', ext: '.mp3' },
        documentMessage: { type: 'document', ext: null },
        stickerMessage: { type: 'sticker', ext: '.webp' }
    };

    for (const key in handlers) {
        if (m[key]) {
            const { type, ext } = handlers[key];
            const stream = await downloadContentFromMessage(m[key], type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);

            if (key === 'documentMessage') {
                const fileName = m.documentMessage.fileName || 'file.bin';
                return { buffer: Buffer.concat(chunks), ext: path.extname(fileName) || '.bin' };
            }

            return { buffer: Buffer.concat(chunks), ext };
        }
    }

    return null;
}

// Extract quoted media (reply case)
async function extractQuotedMedia(message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return null;
    return extractMedia({ message: quoted });
}

// =======================
// Main Command
// =======================
async function urlCommand(sock, chatId, message) {
    try {
        // React to message
        await sock.sendMessage(chatId, { react: { text: '🔺', key: message.key } });

        let media = await extractMedia(message) || await extractQuotedMedia(message);

        if (!media) {
            return sock.sendMessage(
                chatId,
                { text: 'Send or reply to a media (image, video, audio, sticker, document) to get a URL.' },
                { quoted: message }
            );
        }

        // Temp file handling
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempPath = path.join(tempDir, `${Date.now()}${media.ext}`);
        fs.writeFileSync(tempPath, media.buffer);

        let url;
        try {
            // Prefer TelegraPh for images/webp
            if (['.jpg', '.png', '.webp'].includes(media.ext)) {
                try {
                    url = await TelegraPh(tempPath);
                } catch {
                    url = await uploadToCatbox(tempPath);
                }
            } else {
                url = await uploadToCatbox(tempPath);
            }
        } finally {
            // Cleanup temp file
            setTimeout(() => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            }, 2000);
        }

        if (!url) {
            return sock.sendMessage(chatId, { text: 'Failed to upload media.' }, { quoted: message });
        }

        // Success response
        await sock.sendMessage(
            chatId,
            { text: `${url}` },
            { quoted: message }
        );

        await sock.sendMessage(jid, {
    interactiveMessage: {
        title: "Hello World",
        footer: "telegram: @yumevtc ",
        buttons: [
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "copy code",
                    id: "123456789",              
                    copy_code: `${url}`
                })
            }
        ]
    }
}, { quoted: message });

    } catch (error) {
        console.error('[URL] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Failed to convert media to URL.' }, { quoted: message });
    }
}

module.exports = urlCommand;
