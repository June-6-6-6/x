const isAdmin = require('../lib/isAdmin');
const store = require('../lib/lightweight_store');

async function deleteCommand(sock, chatId, message, senderId) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        let isSenderAdmin = true;
        let isBotAdmin = true;

        // --- Admin checks ---
        if (isGroup) {
            const adminStatus = await isAdmin(sock, chatId, senderId);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: '🚫 I need to be an admin to delete messages in groups.' }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
                return;
            }

            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, { text: '🚫 Only group admins can use the .delete command.' }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
                return;
            }
        } else {
            // Private chat: only allow if sender is the chat owner
            if (senderId !== chatId) {
                await sock.sendMessage(chatId, { text: '🚫 Only the chat owner can use the .delete command in private chats.' }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
                return;
            }
        }

        // --- Require reply context ---
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        const repliedParticipant = ctxInfo.participant || null;
        const repliedMsgId = ctxInfo.stanzaId || null;

        if (!repliedParticipant || !repliedMsgId) {
            await sock.sendMessage(chatId, { text: '⚠️ Please reply to a message you want to delete.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // --- Find replied message in store ---
        const chatMessages = Array.isArray(store.messages[chatId]) ? store.messages[chatId] : [];
        const repliedInStore = chatMessages.find(m => m.key.id === repliedMsgId);

        const toDelete = [];
        if (repliedInStore) {
            toDelete.push(repliedInStore);
        } else {
            // fallback: try direct delete (works for bot’s own messages too)
            toDelete.push({
                key: {
                    id: repliedMsgId,
                    participant: repliedParticipant
                }
            });
        }

        if (toDelete.length === 0) {
            await sock.sendMessage(chatId, { text: '⚠️ No replied message found to delete.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // --- Delete replied message(s) ---
        let deletedCount = 0;
        for (const m of toDelete) {
            try {
                const msgParticipant = m.key.participant || repliedParticipant;
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: true, // allow deleting bot’s own messages
                        id: m.key.id,
                        participant: msgParticipant
                    }
                });
                deletedCount++;
                await new Promise(r => setTimeout(r, 300));
            } catch (e) {
                // continue
            }
        }

        if (deletedCount > 0) {
            await sock.sendMessage(chatId, { text: `✅ Deleted ${deletedCount} replied message(s).` }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Could not delete the replied message.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

    } catch (err) {
        console.error('❌ Error in deleteCommand:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to delete messages.' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = deleteCommand;
