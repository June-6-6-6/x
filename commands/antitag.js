const { setAntitag, getAntitag, removeAntitag } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const { getPrefix, handleSetPrefixCommand } = require('./setprefix');

// Store for counting detected tagall messages
const antitagStats = new Map();

async function handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'For Group Admins Only!' }, { quoted: message });
            return;
        }

        const prefix = getPrefix();
        // Fixed: Use dynamic prefix length instead of hardcoded 9
        const commandBody = userMessage.slice(prefix.length + 'antitag'.length).trim();
        const args = commandBody.toLowerCase().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `ANTITAG SETUP\n\n${prefix}antitag on\n${prefix}antitag set delete | kick\n${prefix}antitag off\n${prefix}antitag stats\n`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntitag(chatId);
                // Fixed: Check if antitag is already enabled
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: 'Antitag is already on' }, { quoted: message });
                    return;
                }
                // Fixed: Pass correct parameters to setAntitag
                const result = await setAntitag(chatId, { enabled: true, action: 'delete' });
                await sock.sendMessage(chatId, { 
                    text: result ? 'Antitag has been turned ON' : 'Failed to turn on Antitag' 
                }, { quoted: message });
                break;

            case 'off':
                // Fixed: Use correct function signature
                await removeAntitag(chatId);
                await sock.sendMessage(chatId, { text: 'Antitag has been turned OFF' }, { quoted: message });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `Please specify an action: ${prefix}antitag set delete | kick` 
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick'].includes(setAction)) {
                    await sock.sendMessage(chatId, { 
                        text: 'Invalid action. Choose delete or kick.' 
                    }, { quoted: message });
                    return;
                }
                // Fixed: Update existing config with new action
                const currentConfig = await getAntitag(chatId) || {};
                const setResult = await setAntitag(chatId, { 
                    ...currentConfig, 
                    enabled: true, 
                    action: setAction 
                });
                await sock.sendMessage(chatId, { 
                    text: setResult ? `Antitag action set to ${setAction}` : 'Failed to set Antitag action' 
                }, { quoted: message });
                break;

            case 'get':
                const status = await getAntitag(chatId);
                await sock.sendMessage(chatId, { 
                    text: `Antitag Configuration:\nStatus: ${status?.enabled ? 'ON' : 'OFF'}\nAction: ${status?.action || 'delete'}\nTotal Detected: ${getGroupStats(chatId) || 0} messages` 
                }, { quoted: message });
                break;

            case 'stats':
            case 'info':
                const config = await getAntitag(chatId);
                const stats = getGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: `📊 ANTITAG STATISTICS\n\n🔹 Status: ${config?.enabled ? '🟢 ON' : '🔴 OFF'}\n🔹 Action: ${config?.action || 'delete'}\n🔹 Total Detected: ${stats || 0} messages\n🔹 Last Reset: ${getLastResetTime(chatId)}` 
                }, { quoted: message });
                break;

            case 'reset':
            case 'clear':
                resetGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: 'Antitag statistics have been reset' 
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { text: `Use ${prefix}antitag for usage.` }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antitag command:', error);
        await sock.sendMessage(chatId, { text: 'Error processing antitag command' }, { quoted: message });
    }
}

async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        // Fixed: Get antitag setting without second parameter
        const antitagSetting = await getAntitag(chatId);
        if (!antitagSetting || !antitagSetting.enabled) return;

        // Skip if sender is admin
        const isUserAdmin = await isAdmin(sock, chatId, senderId);
        if (isUserAdmin) return;

        // Get mentioned JIDs from contextInfo (proper mentions)
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        // Extract text from all possible message types
        const messageText = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            message.message?.documentMessage?.caption ||
            ''
        );

        // Enhanced mention detection
        const textMentions = messageText.match(/@[\d+\s\-()~.]+/g) || [];
        const numericMentions = messageText.match(/@\d{10,}/g) || [];
        
        // Count unique mentions properly
        const uniqueMentions = new Set();
        
        // Add proper WhatsApp mentions
        mentionedJids.forEach(jid => {
            if (jid && jid.includes('@s.whatsapp.net')) {
                uniqueMentions.add(jid);
            }
        });
        
        // Add text mentions (fixed logic)
        textMentions.forEach(mention => {
            const cleanMention = mention.replace(/@/g, '').trim();
            // This would need additional logic to map usernames to JIDs
            // For now, we'll count them as potential mentions
            if (cleanMention.length > 0) {
                uniqueMentions.add(`text:${cleanMention}`);
            }
        });
        
        // Add numeric mentions (fixed logic)
        numericMentions.forEach(mention => {
            const numMatch = mention.match(/@(\d+)/);
            if (numMatch && numMatch[1].length >= 10) {
                uniqueMentions.add(`${numMatch[1]}@s.whatsapp.net`);
            }
        });

        const totalUniqueMentions = uniqueMentions.size;

        // Enhanced detection logic with better thresholds
        if (totalUniqueMentions >= 3) {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants || [];
            const totalParticipants = participants.length;
            
            // Dynamic threshold based on group size (fixed calculation)
            let mentionThreshold;
            if (totalParticipants <= 10) {
                mentionThreshold = 3;
            } else if (totalParticipants <= 30) {
                mentionThreshold = Math.max(3, Math.ceil(totalParticipants * 0.4));
            } else {
                mentionThreshold = Math.max(5, Math.ceil(totalParticipants * 0.3));
            }
            
            // Check for mass mentions
            const hasMassMentions = totalUniqueMentions >= mentionThreshold;
            const hasManyNumericMentions = numericMentions.length >= 5; // Reduced threshold
            const hasExcessiveMentions = totalUniqueMentions >= 10; // Reduced threshold

            if (hasMassMentions || hasManyNumericMentions || hasExcessiveMentions) {
                // Increment statistics
                incrementGroupStats(chatId);
                
                const action = antitagSetting.action || 'delete';
                const stats = getGroupStats(chatId);
                
                if (action === 'delete') {
                    // Delete the message
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: false,
                                id: message.key.id,
                                participant: senderId
                            }
                        });
                        
                        // Send warning with stats
                        await sock.sendMessage(chatId, {
                            text: `⚠️ Tagall Detected!\n\n` +
                                  `📍 Mentions: ${totalUniqueMentions} users\n` +
                                  `📊 Total Detected: ${stats} messages\n` +
                                  `🚫 Action: Message deleted`
                        });
                    } catch (deleteError) {
                        console.error('Failed to delete message:', deleteError);
                    }
                    
                } else if (action === 'kick') {
                    // First delete the message
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: false,
                                id: message.key.id,
                                participant: senderId
                            }
                        });
                    } catch (deleteError) {
                        console.error('Failed to delete message:', deleteError);
                    }

                    // Then kick the user
                    try {
                        await sock.groupParticipantsUpdate(chatId, [senderId], "remove");
                        
                        // Send notification with stats
                        await sock.sendMessage(chatId, {
                            text: `🚫 Antitag Detected!\n\n` +
                                  `📍 Mentions: ${totalUniqueMentions} users\n` +
                                  `👤 User: @${senderId.split('@')[0]}\n` +
                                  `📊 Total Detected: ${stats} messages\n` +
                                  `⚡ Action: User kicked`,
                            mentions: [senderId]
                        });
                    } catch (kickError) {
                        console.error('Failed to kick user:', kickError);
                        await sock.sendMessage(chatId, {
                            text: `⚠️ Tagall Detected!\nFailed to kick user (insufficient permissions). Message was deleted.`
                        });
                    }
                }
                
                // Log the detection for debugging
                console.log(`[ANTITAG] Group: ${chatId}, Mentions: ${totalUniqueMentions}, Action: ${action}, Total: ${stats}`);
            }
        }
    } catch (error) {
        console.error('Error in tag detection:', error);
    }
}

// Statistics management functions (fixed initialization)
function incrementGroupStats(chatId) {
    const currentStats = antitagStats.get(chatId);
    if (currentStats) {
        currentStats.count++;
        antitagStats.set(chatId, currentStats);
    } else {
        antitagStats.set(chatId, { count: 1, lastReset: new Date() });
    }
}

function getGroupStats(chatId) {
    const stats = antitagStats.get(chatId);
    return stats ? stats.count : 0;
}

function resetGroupStats(chatId) {
    antitagStats.set(chatId, { count: 0, lastReset: new Date() });
}

function getLastResetTime(chatId) {
    const stats = antitagStats.get(chatId);
    return stats ? stats.lastReset.toLocaleString() : 'Never';
}

// Export functions for external access
function getAllAntitagStats() {
    const stats = {};
    antitagStats.forEach((value, key) => {
        stats[key] = value;
    });
    return stats;
}

module.exports = {
    handleAntitagCommand,
    handleTagDetection,
    getGroupStats,
    resetGroupStats,
    getAllAntitagStats
};
