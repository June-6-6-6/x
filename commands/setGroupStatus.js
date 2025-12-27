const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

async function setGroupStatusCommand(sock, chatId, msg) {
    try {
        // ✅ Group admin check
        const participant = await sock.groupMetadata(chatId).then(metadata => 
            metadata.participants.find(p => p.id === msg.key.participant || p.id === msg.key.remoteJid)
        );
        
        // Check if user is admin or owner
        const isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        
        if (!isAdmin && !msg.key.fromMe) {
            return sock.sendMessage(chatId, { text: '❌ Only group admins can use this command!' });
        }

        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // ✅ Support both command formats
        const commandRegex = /^[.!#/]?(togstatus|swgc|groupstatus|tosgroup)\s*/i;

        // ✅ Show help if only command is typed without quote or text
        if (!quotedMessage && (!messageText.trim() || messageText.trim().match(commandRegex))) {
            return sock.sendMessage(chatId, { text: getHelpText() });
        }

        let payload = null;
        let captionText = '';
        
        // ✅ Extract caption if provided after command (for all media types)
        let textAfterCommand = '';
        if (messageText.trim()) {
            const match = messageText.match(commandRegex);
            if (match) {
                textAfterCommand = messageText.slice(match[0].length).trim();
            }
        }

        // ✅ Handle quoted message (video, image, audio, sticker, or text)
        if (quotedMessage) {
            payload = await buildPayloadFromQuoted(quotedMessage);
            
            // ✅ Add caption from command text if provided (for videos and images)
            if (textAfterCommand && payload && (payload.video || payload.image)) {
                if (payload.video) {
                    payload.caption = textAfterCommand;
                } else if (payload.image) {
                    payload.caption = textAfterCommand;
                }
            }
        } 
        // ✅ Handle plain text command (only text after command)
        else if (messageText.trim()) {
            if (textAfterCommand) {
                payload = { text: textAfterCommand };
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
        let successMsg = `✅ ${mediaType} status sent successfully!`;
        
        if (payload.caption) {
            successMsg += `\nCaption: "${payload.caption}"`;
        }
        
        await sock.sendMessage(chatId, { text: successMsg });

    } catch (error) {
        console.error('Error in group status command:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed: ${error.message}` });
    }
}

/* ------------------ Helpers ------------------ */

// 📌 Shortened help text with blue background
function getHelpText() {
    return `

 ───────「 🎖️ *GROUP STATUS* 」
 *Commands:*
 .togroupstatus/tosgroup
 
 Usage:
 • .tosgroup text
 • Reply to video/image + .tosgroup
 • Add caption after command
 ───────`;
}

// 📌 Build payload from quoted message (Updated with video support)
async function buildPayloadFromQuoted(quotedMessage) {
    // ✅ Handle video message
    if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        return { 
            video: buffer, 
            caption: quotedMessage.videoMessage.caption || '',
            gifPlayback: quotedMessage.videoMessage.gifPlayback || false,
            mimetype: quotedMessage.videoMessage.mimetype || 'video/mp4'
        };
    }
    // ✅ Handle image message
    else if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return { 
            image: buffer, 
            caption: quotedMessage.imageMessage.caption || ''
        };
    }
    // ✅ Handle audio message
    else if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        
        // Check if it's voice note (ptt) or regular audio
        if (quotedMessage.audioMessage.ptt) {
            const audioVn = await toVN(buffer);
            return { 
                audio: audioVn, 
                mimetype: "audio/ogg; codecs=opus", 
                ptt: true 
            };
        } else {
            return { 
                audio: buffer, 
                mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
                ptt: false 
            };
        }
    }
    // ✅ Handle sticker message
    else if (quotedMessage.stickerMessage) {
        const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
        return { 
            sticker: buffer,
            mimetype: quotedMessage.stickerMessage.mimetype || 'image/webp'
        };
    }
    // ✅ Handle text message
    else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: textContent };
    }
    return null;
}

// 📌 Detect media type (Updated with video)
function detectMediaType(quotedMessage) {
    if (!quotedMessage) return 'Text';
    if (quotedMessage.videoMessage) return 'Video';
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
