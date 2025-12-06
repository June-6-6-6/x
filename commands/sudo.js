const fs = require('fs').promises;
const path = require('path');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

// Path for sudo.json
const SUDO_FILE = path.join(__dirname, '..', 'data', 'sudo.json');

// Ensure data directory exists
async function ensureDataDir() {
    const dataDir = path.join(__dirname, '..', 'data');
    try {
        await fs.access(dataDir);
    } catch (error) {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// Read sudo list from JSON file
async function getSudoList() {
    try {
        await ensureDataDir();
        const data = await fs.readFile(SUDO_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is empty, return empty array
        return [];
    }
}

// Save sudo list to JSON file
async function saveSudoList(list) {
    try {
        await ensureDataDir();
        await fs.writeFile(SUDO_FILE, JSON.stringify(list, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving sudo list:', error);
        return false;
    }
}

// Add a user to sudo list
async function addSudo(jid) {
    try {
        const list = await getSudoList();
        
        // Normalize JID before adding
        const normalizedJid = normalizeJid(jid);
        if (!normalizedJid) return false;
        
        // Check if already exists
        if (list.includes(normalizedJid)) return false;
        
        list.push(normalizedJid);
        const success = await saveSudoList(list);
        return success;
    } catch (error) {
        console.error('Error adding sudo:', error);
        return false;
    }
}

// Remove a user from sudo list
async function removeSudo(jid) {
    try {
        const list = await getSudoList();
        
        // Normalize JID
        const normalizedJid = normalizeJid(jid);
        if (!normalizedJid) return false;
        
        // Find index
        const index = list.indexOf(normalizedJid);
        if (index === -1) return false;
        
        // Remove from list
        list.splice(index, 1);
        const success = await saveSudoList(list);
        return success;
    } catch (error) {
        console.error('Error removing sudo:', error);
        return false;
    }
}

// Check if a user is sudo
async function isSudo(jid) {
    try {
        const list = await getSudoList();
        const normalizedJid = normalizeJid(jid);
        return list.includes(normalizedJid);
    } catch (error) {
        console.error('Error checking sudo:', error);
        return false;
    }
}

// Format number for display
function formatNumberForDisplay(jid) {
    if (!jid) return 'Unknown';
    const number = jid.split('@')[0];
    // Format with country code if it's long enough
    if (number.length > 10) {
        return `+${number}`;
    }
    return number;
}

// Extract mentioned JID
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

// Normalize JID
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

// Main sudo command handler
async function sudoCommand(sock, chatId, message) {
    try {
        const senderJid = message.key.participant || message.key.remoteJid;
        const isOwner = message.key.fromMe || await isOwnerOrSudo(senderJid, sock, chatId);

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(' ').slice(1);
        const sub = (args[0] || '').toLowerCase();

        if (!sub || !['add', 'del', 'remove', 'list', 'help', 'check'].includes(sub)) {
            await sock.sendMessage(chatId, { 
                text: '🤖 *Sudo Command*\n\n' +
                      '*.sudo add* <@user|number> - Add sudo user\n' +
                      '*.sudo del* <@user|number> - Remove sudo user\n' +
                      '*.sudo list* - Show all sudo users\n' +
                      '*.sudo check* - Check if you are sudo\n' +
                      '*.sudo help* - Show this help\n\n' +
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
            
            // Format the list nicely
            let formattedList = '👑 *Sudo Users* \n';
            formattedList += `Total: ${list.length} user(s)\n\n`;
            
            list.forEach((jid, index) => {
                const number = formatNumberForDisplay(jid);
                formattedList += `${index + 1}. ${number}\n`;
            });
            
            formattedList += `\n📁 Stored in: data/sudo.json`;
            
            await sock.sendMessage(chatId, { 
                text: formattedList 
            }, { quoted: message });
            return;
        }

        if (sub === 'check') {
            const isUserSudo = await isSudo(senderJid);
            const isUserOwner = message.key.fromMe || await isOwnerOrSudo(senderJid, sock, chatId, true);
            
            let statusText = '🔍 *Sudo Status*\n\n';
            statusText += `User: ${formatNumberForDisplay(senderJid)}\n`;
            statusText += `Owner: ${isUserOwner ? '✅ Yes' : '❌ No'}\n`;
            statusText += `Sudo: ${isUserSudo ? '✅ Yes' : '❌ No'}\n`;
            
            await sock.sendMessage(chatId, { 
                text: statusText 
            }, { quoted: message });
            return;
        }

        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only bot owner can add/remove sudo users.\nUse *.sudo list* to view current sudo users.\nUse *.sudo check* to check your status.' 
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
                        `✅ Added sudo user:\n${formatNumberForDisplay(targetJid)}\n\n📁 Saved to: data/sudo.json` : 
                        '❌ Failed to add sudo user. User might already be sudo or invalid.' 
                }, { quoted: message });
                return;
            }

            if (sub === 'del' || sub === 'remove') {
                // Check if trying to remove owner
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
                        `✅ Removed sudo user:\n${formatNumberForDisplay(targetJid)}\n\n📁 Updated: data/sudo.json` : 
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

// Export all functions
module.exports = {
    sudoCommand,
    getSudoList,
    addSudo,
    removeSudo,
    isSudo,
    normalizeJid
};
