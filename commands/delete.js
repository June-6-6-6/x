const isAdmin = require('../lib/isAdmin');
const store = require('../lib/lightweight_store');

async function deleteCommand(sock, chatId, message, senderId) {
    try {
        const isGroup = chatId.endsWith('@g.us');

        // --- Privilege checks ---
        let isSenderAdmin = true;
        let isBotAdmin = true;

        if (isGroup) {
            const { isSenderAdmin: senderAdmin, isBotAdmin: botAdmin } = await isAdmin(sock, chatId, senderId);
            isSenderAdmin = senderAdmin;
            isBotAdmin = botAdmin;

            if (!isBotAdmin) {
                return sendFeedback(sock, chatId, message, '🚫 I need to be an admin to delete messages in groups.');
            }
            if (!isSenderAdmin) {
                return sendFeedback(sock, chatId, message, '🚫 Only group admins can use the .delete command.');
            }
        } else {
            if (senderId !== chatId) {
                return sendFeedback(sock, chatId, message, '🚫 Only the chat owner can use the .delete command in private chats.');
            }
        }

        // --- Parse arguments ---
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        let countArg = parseCount(parts);

        // --- Context info ---
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        const mentioned = Array.isArray(ctxInfo.mentionedJid) && ctxInfo.mentionedJid.length > 0 ? ctxInfo.mentionedJid[0] : null;
        const repliedParticipant = ctxInfo.participant || null;

        let targetUser = null;
        let repliedMsgId = null;

        if (repliedParticipant && ctxInfo.stanzaId) {
            targetUser = repliedParticipant;
            repliedMsgId = ctxInfo.stanzaId;
        } else if (mentioned) {
            targetUser = mentioned;
        } else {
            targetUser = isGroup ? null : chatId;
        }

        if (!targetUser) {
            return sendFeedback(sock, chatId, message, '⚠️ Please reply to a user\'s message or mention a user to delete their recent messages.');
        }

        // --- Collect messages to delete ---
        const chatMessages = Array.isArray(store.messages[chatId]) ? store.messages[chatId] : [];
        const toDelete = collectMessages(message, chatMessages, targetUser, repliedMsgId, senderId, countArg);

        if (toDelete.length === 0) {
            return sendFeedback(sock, chatId, message, '⚠️ No recent messages found for the target user.');
        }

        // --- Perform deletion ---
        let deletedCount = 0;
        for (const m of toDelete) {
            try {
                const msgParticipant = m.key.participant || targetUser;
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: m.key.id,
                        participant: msgParticipant
                    }
                });
                deletedCount++;
                await delay(300);
            } catch (e) {
                // Defensive: continue without breaking flow
            }
        }

        if (deletedCount > 0) {
            await sendFeedback(sock, chatId, message, `✅ Deleted ${deletedCount} message(s).`);
        }

    } catch (err) {
        await sendFeedback(sock, chatId, message, '❌ Failed to delete messages.');
    }
}

// --- Helpers ---
function sendFeedback(sock, chatId, quotedMsg, text) {
    return sock.sendMessage(chatId, { text }, { quoted: quotedMsg });
}

function parseCount(parts) {
    if (parts.length > 1) {
        const maybeNum = parseInt(parts[1], 10);
        if (!isNaN(maybeNum) && maybeNum > 0) {
            return Math.min(maybeNum, 50);
        }
    }
    return 1;
}

function collectMessages(message, chatMessages, targetUser, repliedMsgId, senderId, countArg) {
    const toDelete = [];
    const seenIds = new Set();

    // Always include the command message itself
    if (message.key?.id) {
        toDelete.push({ key: { id: message.key.id, participant: senderId } });
        seenIds.add(message.key.id);
    }

    // Handle replied message
    if (repliedMsgId) {
        const repliedInStore = chatMessages.find(m => m.key.id === repliedMsgId && (m.key.participant || m.key.remoteJid) === targetUser);
        if (repliedInStore && !seenIds.has(repliedInStore.key.id)) {
            toDelete.push(repliedInStore);
            seenIds.add(repliedInStore.key.id);
        }
    }

    // Collect recent messages from target user
    for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < countArg + 1; i--) {
        const m = chatMessages[i];
        const participant = m.key.participant || m.key.remoteJid;
        if (participant === targetUser && !seenIds.has(m.key.id)) {
            if (!m.message?.protocolMessage) {
                toDelete.push(m);
                seenIds.add(m.key.id);
            }
        }
    }

    return toDelete;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = deleteCommand;
