const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

async function setGroupStatusCommand(sock, chatId, msg) {
    try {
        // ✅ Owner check
        if (!msg.key.fromMe) return sock.sendMessage(chatId, { text: '❌ Only the owner can use this command!' });

        // ✅ Group check
        const chat = await sock.groupMetadata(chatId).catch(() => null);
        if (!chat) return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups!' });

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
        const cmdRegex = /^[.!#/]?(togstatus|swgc|groupstatus)\s*/i;

        // ✅ Show help if only command is typed
        if (!quoted && (!text.trim() || cmdRegex.test(text.trim()))) {
            return sock.sendMessage(chatId, { text: helpMessage() });
        }

        // ✅ Extract caption only if `|` is used
        let caption = '';
        if (text.includes('|')) {
            caption = text.split('|').slice(1).join('|').trim();
        }

        let payload;
        if (quoted) {
            if ('imageMessage' in quoted) {
                payload = await buildPayload(quoted.imageMessage, 'image', caption);
            } else if ('audioMessage' in quoted) {
                payload = await buildAudioPayload(quoted.audioMessage, caption);
            } else if ('stickerMessage' in quoted) {
                payload = await buildPayload(quoted.stickerMessage, 'sticker');
            }
        } else {
            // If no quoted media, treat as text status
            payload = { text: caption || text.replace(cmdRegex, '').trim() };
        }

        // ✅ Send group status
        await sendGroupStatus(sock, chatId, payload);

        const type = quoted
            ? ('imageMessage' in quoted ? 'Image'
                : 'audioMessage' in quoted ? 'Audio'
                : 'stickerMessage' in quoted ? 'Sticker'
                : 'Text')
            : 'Text';

        await sock.sendMessage(chatId, { text: `✅ ${type} status sent to group!${caption ? `\nCaption: "${caption}"` : ''}` });

    } catch (err) {
        console.error('Error in togstatus command:', err);
        await sock.sendMessage(chatId, { text: `❌ Failed: ${err.message}` });
    }
}

// ✅ Helpers
function helpMessage() {
    return `📌 *Group Status Command Usage*\n
*Note:* Works only in groups

*Usage:*
• Just command → Show this help
• Command + text → Send text status
• Command + | + text → Send text status
• Reply to image + command → Send image status
• Reply to audio + command → Send audio status
• Reply to sticker + command → Send sticker status

*Examples:*
• \`!togstatus Hello World\` → Text status
• \`!togstatus | Check this out!\` → Text status
• Reply to photo with \`!togstatus | Beautiful sunset\` → Image status with caption
• Reply to audio with \`!togstatus | My voice note\` → Audio status with caption`;
}

async function buildPayload(msg, type, caption = '') {
    const stream = await downloadContentFromMessage(msg, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return type === 'image'
        ? { image: buffer, ...(caption ? { caption } : {}) }
        : { sticker: buffer };
}

async function buildAudioPayload(msg, caption = '') {
    const stream = await downloadContentFromMessage(msg, 'audio');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    const audioVn = await toVN(buffer);
    return {
        audio: audioVn,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        ...(caption ? { caption } : {})
    };
}

async function sendGroupStatus(conn, jid, content) {
    const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const secret = crypto.randomBytes(32);
    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret: secret },
        groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret: secret } } }
    }, {});
    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inStream = new PassThrough(); inStream.end(inputBuffer);
        const outStream = new PassThrough(); const chunks = [];
        ffmpeg(inStream)
            .noVideo().audioCodec("libopus").format("ogg")
            .audioBitrate("48k").audioChannels(1).audioFrequency(48000)
            .on("error", reject).on("end", () => resolve(Buffer.concat(chunks)))
            .pipe(outStream, { end: true });
        outStream.on("data", chunk => chunks.push(chunk));
    });
}

module.exports = setGroupStatusCommand;
