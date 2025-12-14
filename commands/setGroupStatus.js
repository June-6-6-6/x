const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

async function setGroupStatusCommand(sock, chatId, msg) {
    try {
        // ✅ Owner check
        if (!msg.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Only the owner can use this command!' });
        }

        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const commandRegex = /^[.!#/]?(togstatus|swgc|groupstatus)\s*/i;

        // ✅ Show help if only command is typed without quote
        if (!quotedMessage && (!messageText.trim() || messageText.trim().match(commandRegex))) {
            return sock.sendMessage(chatId, { text: getHelpText() });
        }

        let payload = null;
        
        // ✅ Handle quoted message (image, audio, sticker, or text)
        if (quotedMessage) {
            payload = await buildPayloadFromQuoted(quotedMessage);
        } 
        // ✅ Handle plain text command (only text after command)
        else if (messageText.trim()) {
            // Extract only the text after the command
            const textContent = messageText.replace(commandRegex, '').trim();
            if (textContent) {
                payload = { text: textContent };
            } else {
                return sock.sendMessage(chatId, { text: getHelpText() });
            }
        }

        if (!payload) {
            return sock.sendMessage(chatId, { text: getHelpText() });
        }

        // ✅ Send group status
        await sendGroupStatus(sock, chatId, payload);

        const mediaType = detectMediaType(quotedMessage);
        await sock.sendMessage(chatId, { 
            text: `✅ ${mediaType} status sent successfully!${payload.caption ? `\nCaption: "${payload.caption}"` : ''}` 
        });

    } catch (error) {
        console.error('Error in togstatus command:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed: ${error.message}` });
    }
}

/* ------------------ Helpers ------------------ */

// 📌 Short help text
function getHelpText() {
    return `📌 *Group Status Command*\n\n` +
           `*Usage:*\n` +
           `• \`!togstatus your text here\` - Send text status\n` +
           `• Reply to an image/audio/sticker with \`!togstatus\` - Send media status\n` +
           `• Reply to text with \`!togstatus\` - Send quoted text as status\n\n` +
           `*Note:* Captions are only supported for images.`;
}

// 📌 Build payload from quoted message
async function buildPayloadFromQuoted(quotedMessage) {
    if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return { 
            image: buffer, 
            caption: quotedMessage.imageMessage.caption || ''
        };
    }
    if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        const audioVn = await toVN(buffer);
        return { 
            audio: audioVn, 
            mimetype: "audio/ogg; codecs=opus", 
            ptt: true 
        };
    }
    if (quotedMessage.stickerMessage) {
        const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
        return { sticker: buffer };
    }
    if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        // Extract only the text content from the quoted message
        const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: textContent };
    }
    return null;
}

// 📌 Detect media type
function detectMediaType(quotedMessage) {
    if (!quotedMessage) return 'Text';
    if (quotedMessage.imageMessage) return 'Image';
    if (quotedMessage.audioMessage) return 'Audio';
    if (quotedMessage.stickerMessage) return 'Sticker';
    return 'Text';
}

// 📌 Download message content to buffer
async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

// 📌 Send group status
async function sendGroupStatus(conn, jid, content) {
    const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageSecret = crypto.randomBytes(32);

    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
    }, {});

    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

// 📌 Convert audio to voice note
async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inStream = new PassThrough();
        inStream.end(inputBuffer);
        const outStream = new PassThrough();
        const chunks = [];

        ffmpeg(inStream)
            .noVideo()
            .audioCodec("libopus")
            .format("ogg")
            .audioBitrate("48k")
            .audioChannels(1)
            .audioFrequency(48000)
            .on("error", reject)
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe(outStream, { end: true });

        outStream.on("data", chunk => chunks.push(chunk));
    });
}

module.exports = setGroupStatusCommand;
