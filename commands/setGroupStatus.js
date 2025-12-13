const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

async function setGroupStatusCommand(sock, chatId, msg) {
    try {
        // Owner check
        if (!msg.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Only the owner can use this command!' });
        }

        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // Show help if only command is typed
        if (!quotedMessage && !messageText.replace(/^[.!#/]?\w+\s*/i, '').trim()) {
            return sock.sendMessage(chatId, { text: getHelpText() });
        }

        // Parse command
        const { content, color, groupUrl } = parseCommand(messageText, quotedMessage);
        const targetGroupId = await resolveGroupId(sock, chatId, groupUrl);
        
        // Color mapping
        const bgColor = getColor(color);
        
        // Build payload
        const payload = quotedMessage 
            ? await buildPayloadFromQuoted(quotedMessage, content, bgColor)
            : { text: content, backgroundColor: bgColor };

        // Send group status
        await sendGroupStatus(sock, targetGroupId, payload);

        // Send confirmation
        const mediaType = detectMediaType(quotedMessage);
        await sendConfirmation(sock, chatId, {
            mediaType,
            caption: content,
            color,
            groupUrl,
            targetGroupId
        });

    } catch (error) {
        console.error('Error in group status command:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed: ${error.message}` });
    }
}

/* ------------------ Core Functions ------------------ */

function parseCommand(messageText, quotedMessage) {
    const commandRegex = /^[.!#/]?(tosgroup|swgc|togroupstatus)\s*/i;
    const fullQuery = messageText.replace(commandRegex, '').trim();
    
    const parts = fullQuery.split('|').map(s => s.trim());
    let [content, color, groupUrl] = parts;
    
    // If no quoted message and we have content without pipes, use it as text
    if (!quotedMessage && fullQuery && parts.length === 1) {
        content = fullQuery;
    }
    
    return { content, color, groupUrl };
}

async function resolveGroupId(sock, chatId, groupUrl) {
    if (!groupUrl) return chatId;
    
    try {
        const inviteCode = groupUrl.split('/').pop().split('?')[0];
        const groupInfo = await sock.groupGetInviteInfo(inviteCode);
        await sock.sendMessage(chatId, { text: `🎯 Target: ${groupInfo.subject}` });
        return groupInfo.id;
    } catch {
        throw new Error('Invalid group link or bot not in that group');
    }
}

function getColor(colorName) {
    const colors = {
        blue: '#34B7F1',
        green: '#25D366',
        yellow: '#FFD700',
        orange: '#FF8C00',
        red: '#FF3B30',
        purple: '#9C27B0',
        gray: '#9E9E9E',
        grey: '#9E9E9E',
        black: '#000000',
        white: '#FFFFFF',
        cyan: '#00BCD4'
    };
    return colors[colorName?.toLowerCase()] || colors.blue;
}

async function buildPayloadFromQuoted(quotedMessage, caption, bgColor) {
    const payload = { backgroundColor: bgColor };
    
    if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        payload.image = buffer;
        if (isValidCaption(caption)) {
            payload.caption = caption;
        }
    } 
    else if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        payload.video = buffer;
        if (isValidCaption(caption)) {
            payload.caption = caption;
        }
    }
    else if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        payload.audio = await convertToVoiceNote(buffer);
        payload.mimetype = 'audio/ogg; codecs=opus';
        payload.ptt = true;
        
        if (isValidCaption(caption)) {
            payload.caption = caption;
        }
        
        // Optional waveform
        try {
            payload.waveform = await generateWaveform(buffer);
        } catch {
            // Waveform is optional, ignore errors
        }
    }
    else if (quotedMessage.stickerMessage) {
        const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
        payload.sticker = buffer;
        delete payload.backgroundColor; // Stickers don't need background
    }
    else if (quotedMessage.conversation || quotedMessage.extendedTextMessage) {
        const quotedText = quotedMessage.conversation || 
                          quotedMessage.extendedTextMessage?.text || '';
        payload.text = caption || quotedText;
    }
    
    return payload;
}

async function sendGroupStatus(conn, jid, content) {
    const { backgroundColor } = content;
    if (backgroundColor) {
        delete content.backgroundColor;
    }
    
    const inside = await generateWAMessageContent(content, { 
        upload: conn.waUploadToServer,
        ...(backgroundColor && { backgroundColor })
    });
    
    const messageSecret = crypto.randomBytes(32);
    
    const message = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { 
            message: { 
                ...inside, 
                messageContextInfo: { messageSecret } 
            } 
        }
    }, {});
    
    await conn.relayMessage(jid, message.message, { messageId: message.key.id });
    return message;
}

async function sendConfirmation(sock, chatId, { mediaType, caption, color, groupUrl, targetGroupId }) {
    const statusMsg = `✅ ${mediaType || 'Text'} status sent!`;
    const captionMsg = caption ? `\nCaption: "${caption}"` : '';
    const colorMsg = color ? `\nColor: ${color}` : '';
    const groupMsg = groupUrl ? `\nTo: ${targetGroupId}` : '';
    
    await sock.sendMessage(chatId, { 
        text: `${statusMsg}${captionMsg}${colorMsg}${groupMsg}` 
    });
}

/* ------------------ Utility Functions ------------------ */

function getHelpText() {
    return `📌 Group Status Command\n\n` +
           `Basic Usage:\n` +
           `• !togstatus text|color|group_url - Text status\n` +
           `• Reply to media + !togstatus caption|color|group_url\n\n` +
           `Colors: blue, green, red, yellow, orange, purple, gray, cyan, black, white\n\n` +
           `Examples:\n` +
           `• !togstatus Hello World|blue\n` +
           `• !togstatus |red|group.link/abc123\n` +
           `• Reply photo: !togstatus Nice pic!|green`;
}

function detectMediaType(quotedMessage) {
    if (!quotedMessage) return 'Text';
    if (quotedMessage.imageMessage) return 'Image';
    if (quotedMessage.videoMessage) return 'Video';
    if (quotedMessage.audioMessage) return 'Audio';
    if (quotedMessage.stickerMessage) return 'Sticker';
    return 'Text';
}

function isValidCaption(text) {
    if (!text || !text.trim()) return false;
    
    // Skip command-like text
    const commandPattern = /^[.!#/]?(togstatus|swgc|groupstatus)/i;
    const colorPattern = /^\|\s*(blue|green|red|yellow|orange|purple|gray|grey|cyan|black|white)/i;
    
    return !commandPattern.test(text) && !colorPattern.test(text);
}

/* ------------------ Media Processing ------------------ */

async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function convertToVoiceNote(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inStream = new PassThrough();
        inStream.end(inputBuffer);
        const chunks = [];

        ffmpeg(inStream)
            .noVideo()
            .audioCodec('libopus')
            .format('ogg')
            .audioBitrate('48k')
            .audioChannels(1)
            .audioFrequency(48000)
            .outputOptions([
                '-map_metadata -1',
                '-application voip',
                '-compression_level 10'
            ])
            .on('error', reject)
            .on('end', () => resolve(Buffer.concat(chunks)))
            .pipe(new PassThrough())
            .on('data', chunk => chunks.push(chunk));
    });
}

async function generateWaveform(inputBuffer, bars = 64) {
    return new Promise((resolve, reject) => {
        const inputStream = new PassThrough();
        inputStream.end(inputBuffer);
        const chunks = [];

        ffmpeg(inputStream)
            .audioChannels(1)
            .audioFrequency(16000)
            .format('s16le')
            .on('error', reject)
            .on('end', () => {
                const raw = Buffer.concat(chunks);
                const amplitudes = [];
                
                for (let i = 0; i < raw.length; i += 2) {
                    amplitudes.push(Math.abs(raw.readInt16LE(i)) / 32768);
                }

                const blockSize = Math.floor(amplitudes.length / bars);
                const averages = [];
                
                for (let i = 0; i < bars; i++) {
                    const slice = amplitudes.slice(i * blockSize, (i + 1) * blockSize);
                    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
                    averages.push(avg);
                }

                const max = Math.max(...averages);
                const normalized = averages.map(v => 
                    max > 0 ? Math.floor((v / max) * 100) : 0
                );
                
                resolve(Buffer.from(new Uint8Array(normalized)).toString('base64'));
            })
            .pipe()
            .on('data', chunk => chunks.push(chunk));
    });
}

module.exports = setGroupStatusCommand;
