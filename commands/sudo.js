const settings = require('../settings');
const { addSudo, removeSudo, getSudoList } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');

function extractMentionedJid(message) {
    // First, check for mentioned JID in extended text message
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length > 0) return mentioned[0];
    
    // Check for quoted message mentions
    const quotedMentioned = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (quotedMentioned.length > 0) return quotedMentioned[0];
    
    // Extract from text with better number matching
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    
    // Match numbers with country codes and without
    const match = text.match(/(?:\+|@)?(\d{7,15})(?:@s\.whatsapp\.net)?/);
    if (match) {
        let number = match[1];
        // Remove leading zeros if any
        number = number.replace(/^0+/, '');
        // Ensure proper JID format
        return number + '@s.whatsapp.net';
    }
    
    return null;
}

function normalizeJid(jid) {
    if (!jid) return null;
    
    // Remove any suffixes and ensure proper format
    jid = jid.split('/')[0];
    
    // If it's already a full JID, return as is
    if (jid.includes('@s.whatsapp.net')) {
        return jid;
    }
    
    // If it's just a number, format it properly
    if (/^\d+$/.test(jid)) {
        return jid.replace(/^0+/, '') + '@s.whatsapp.net';
    }
    
    return jid;
}

async function sudoCommand(sock, chatId, message) {
    try {
        const senderJid = message.key.participant || message.key.remoteJid;
        const isOwner = message.key.fromMe || await isOwnerOrSudo(senderJid, sock, chatId);

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(' ').slice(1);
        const sub = (args[0] || '').toLowerCase();

        if (!sub || !['add', 'del', 'remove', 'list', 'help'].includes(sub)) {
            await sock.sendMessage(chatId, { 
                text: '🤖 *Sudo Command*\n\n' +
                      '*.sudo add* <@user|number> - Add sudo user\n' +
                      '*.sudo del* <@user|number> - Remove sudo user\n' +
                      '*.sudo list* - Show all sudo users\n\n' +
                      'Only bot owner can add/remove sudo users.'
            }, { quoted: message });
            return;
        }

        if (sub === 'list') {
            const list = await getSudoList();
            if (list.length === 0) {
                await sock.sendMessage(chatId, { text: '📝 No sudo users configured.' }, { quoted: message });
                return;
            }
            
            const formattedList = list.map((j, i) => `${i + 1}. ${j.split('@')[0]}`).join('\n');
            await sock.sendMessage(chatId, { 
                text: `👑 *Sudo Users* (${list.length})\n\n${formattedList}` 
            }, { quoted: message });
            return;
        }

        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only bot owner can add/remove sudo users.\nUse *.sudo list* to view current sudo users.' 
            }, { quoted: message });
            return;
        }

        // For add/del/remove commands, require a target
        if (sub === 'add' || sub === 'del' || sub === 'remove') {
            let targetJid = extractMentionedJid(message);
            
            // If no mention found, try to get from arguments
            if (!targetJid && args.length > 1) {
                targetJid = normalizeJid(args[1]);
            }
            
            if (!targetJid) {
                await sock.sendMessage(chatId, { 
                    text: 'Please mention a user or provide a number.\nExample: *.sudo add @user* or *.sudo add 123456789*' 
                }, { quoted: message });
                return;
            }
            
            // Normalize the JID
            targetJid = normalizeJid(targetJid);
            
            if (!targetJid || !targetJid.includes('@s.whatsapp.net')) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid user format. Please provide a valid number or mention a user.' 
                }, { quoted: message });
                return;
            }

            if (sub === 'add') {
                const ok = await addSudo(targetJid);
                await sock.sendMessage(chatId, { 
                    text: ok ? 
                        `✅ Added sudo user:\n${targetJid.split('@')[0]}` : 
                        '❌ Failed to add sudo user. User might already be sudo.' 
                }, { quoted: message });
                return;
            }

            if (sub === 'del' || sub === 'remove') {
                const ownerJid = settings.ownerNumber + '@s.whatsapp.net';
                if (targetJid === ownerJid) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Cannot remove bot owner from sudo list.' 
                    }, { quoted: message });
                    return;
                }
                
                const ok = await removeSudo(targetJid);
                await sock.sendMessage(chatId, { 
                    text: ok ? 
                        `✅ Removed sudo user:\n${targetJid.split('@')[0]}` : 
                        '❌ Failed to remove sudo user. User might not be in sudo list.' 
                }, { quoted: message });
                return;
            }
        }
    } catch (error) {
        console.error('Sudo command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing sudo command.' 
        }, { quoted: message });
    }
}

module.exports = sudoCommand;
