const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { TelegraPh } = require('../lib/uploader');

// 🔹 Upload to Catbox
async function uploadToCatbox(filePath) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", fs.createReadStream(filePath));

    const { data } = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders()
    });
    return data; // permanent URL
}

// 🔹 Extract buffer + extension from message
async function getMediaBufferAndExt(message) {
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

// 🔹 Handle quoted media
async function getQuotedMediaBufferAndExt(message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    return quoted ? getMediaBufferAndExt({ message: quoted }) : null;
}

// 🔹 Main command
async function urlCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🖇️', key: message.key } });

        let media = await getMediaBufferAndExt(message) || await getQuotedMediaBufferAndExt(message);
        if (!media) {
            return sock.sendMessage(chatId, { text: 'Send or reply to a media (image, video, audio, sticker, document) to get a URL.' }, { quoted: message });
        }

        // temp file handling
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const tempPath = path.join(tempDir, `${Date.now()}${media.ext}`);
        fs.writeFileSync(tempPath, media.buffer);

        let url;
        try {
            if (['.jpg', '.png', '.webp'].includes(media.ext)) {
                url = await TelegraPh(tempPath).catch(() => uploadToCatbox(tempPath));
            } else {
                url = await uploadToCatbox(tempPath);
            }
        } finally {
            // cleanup
            setTimeout(() => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            }, 2000);
        }

        if (!url) {
            return sock.sendMessage(chatId, { text: 'Failed to upload media.' }, { quoted: message });
        }

        // 🔹 Interactive message with copy + open buttons
        await sock.sendMessage(chatId, {
            interactiveMessage: {
                title: "Your URL",
                footer: "t.me/supremeLord",
                body: { text: url },
                buttons: [
                    {
                        name: "cta_copy",
                        buttonParamsJson: JSON.stringify({
                            display_text: "📋 Copy URL",
                            id: `copy_${Date.now()}`,
                            copy_code: url
                        })
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🌐 Open Link",
                            url
                        })
                    }
                ]
            }
        }, { quoted: message });

    } catch (error) {
        console.error('[URL] error:', error);
        await sock.sendMessage(chatId, { text: 'Failed to convert media to URL.' }, { quoted: message });
    }
}

module.exports = urlCommand;
