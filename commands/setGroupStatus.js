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

        // ✅ Show help if only command is typed
        if (!quotedMessage && (!messageText.trim() || commandRegex.test(messageText.trim()))) {
            return sock.sendMessage(chatId, { text: getHelpText() });
        }

        // ✅ Extract caption
        let caption = extractCaption(messageText, commandRegex);

        // ✅ Build payload
        const payload = quotedMessage ? await buildPayloadFromQuoted(quotedMessage, caption) : { text: caption };

        if (!caption && !quotedMessage) {
            return sock.sendMessage(chatId, { text: getHelpText() });
        }

        // ✅ Send group status
        await sendGroupStatus(sock, chatId, payload);

        const mediaType = detectMediaType(quotedMessage);
        await sock.sendMessage(chatId, { text: `✅ ${mediaType} status sent!${caption ? `\nCaption: "${caption}"` : ''}` });

    } catch (error) {
        console.error('Error in togstatus command:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed: ${error.message}` });
    }
}

/* ------------------ Helpers ------------------ */

// 📌 Short help text
function getHelpText() {
    return `📌 *Group Status*\n\n` +
           `• togstatus| → Help\n` +
           `• togstatus| + text → Text\n` +
           `• togstatus| + caption → Text\n` +
           `• Reply img/audio/sticker + togstatus → Media\n\n` +
           `*Examples:*\n` +
           `• \`togstatus Hello\`\n` +
           `• \`togstatus | Caption\`\n` +
           `• Reply photo: \`togstatus | Nice!\``;
}

// 📌 Extract caption from text
function extractCaption(messageText, commandRegex) {
    const fullText = messageText.replace(commandRegex, '').trim();
    if (!fullText) return '';

    if (fullText.includes('|')) {
        return fullText.split('|').slice(1).join('|').trim();
    }
    return fullText.replace(commandRegex, '').trim();
}

// 📌 Build payload from quoted message
async function buildPayloadFromQuoted(quotedMessage, caption) {
    if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return { image: buffer, caption };
    }
    if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        const audioVn = await toVN(buffer);
        return { audio: audioVn, mimetype: "audio/ogg; codecs=opus", ptt: true, caption };
    }
    if (quotedMessage.stickerMessage) {
        const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
        return { sticker: buffer };
    }
    return { text: caption };
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
