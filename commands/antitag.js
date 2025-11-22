const { setAntitag, getAntitag, removeAntitag } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const { getPrefix, handleSetPrefixCommand } = require('./setprefix');
// Store for counting detected tagall messages
const antitagStats = new Map();

async function handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        const prefix = getPrefix();
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `\`\`\`ANTITAG SETUP\n\n${prefix}antitag on\n${prefix}antitag set delete | kick\n${prefix}antitag off\n${prefix}antitag stats\n\`\`\``;
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntitag(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antitag is already on_*' }, { quoted: message });
                    return;
                }
                const result = await setAntitag(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? '*_Antitag has been turned ON_*' : '*_Failed to turn on Antitag_*' 
                }, { quoted: message });
                break;

            case 'off':
                await removeAntitag(chatId, 'on');
                await sock.sendMessage(chatId, { text: '*_Antitag has been turned OFF_*' }, { quoted: message });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `*_Please specify an action: ${prefix}antitag set delete | kick_*` 
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick'].includes(setAction)) {
                    await sock.sendMessage(chatId, { 
                        text: '*_Invalid action. Choose delete or kick._*' 
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntitag(chatId, 'on', setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `*_Antitag action set to ${setAction}_*` : '*_Failed to set Antitag action_*' 
                }, { quoted: message });
                break;

            case 'get':
                const status = await getAntitag(chatId, 'on');
                await sock.sendMessage(chatId, { 
                    text: `*_Antitag Configuration:_*\nStatus: ${status?.enabled ? 'ON' : 'OFF'}\nAction: ${status?.action || 'delete'}\nTotal Detected: ${getGroupStats(chatId) || 0} messages` 
                }, { quoted: message });
                break;

            case 'stats':
            case 'info':
                const config = await getAntitag(chatId, 'on');
                const stats = getGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: `*_📊 ANTITAG STATISTICS_*\n\n🔹 *Status:* ${config?.enabled ? '🟢 ON' : '🔴 OFF'}\n🔹 *Action:* ${config?.action || 'delete'}\n🔹 *Total Detected:* ${stats || 0} messages\n🔹 *Last Reset:* ${getLastResetTime(chatId)}` 
                }, { quoted: message });
                break;

            case 'reset':
            case 'clear':
                resetGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: '*_Antitag statistics have been reset_*' 
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antitag for usage._*` }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antitag command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antitag command_*' }, { quoted: message });
    }
}

async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        const antitagSetting = await getAntitag(chatId, 'on');
        if (!antitagSetting || !antitagSetting.enabled) return;

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
                uniqueMentions.add(jid.split('@')[0]);
            }
        });
        
        // Add text mentions
        textMentions.forEach(mention => {
            const cleanMention = mention.replace(/@/g, '').replace(/[^\d]/g, '');
            if (cleanMention.length >= 10) {
                uniqueMentions.add(cleanMention);
            }
        });
        
        // Add numeric mentions
        numericMentions.forEach(mention => {
            const numMatch = mention.match(/@(\d+)/);
            if (numMatch) uniqueMentions.add(numMatch[1]);
        });

        const totalUniqueMentions = uniqueMentions.size;

        // Enhanced detection logic
        if (totalUniqueMentions >= 3) {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants || [];
            const totalParticipants = participants.length;
            
            // Dynamic threshold based on group size
            let mentionThreshold;
            if (totalParticipants <= 10) {
                mentionThreshold = 3;
            } else if (totalParticipants <= 30) {
                mentionThreshold = Math.ceil(totalParticipants * 0.4);
            } else {
                mentionThreshold = Math.ceil(totalParticipants * 0.3);
            }
            
            // Check for mass mentions
            const hasMassMentions = totalUniqueMentions >= mentionThreshold;
            const hasManyNumericMentions = numericMentions.length >= 8;
            const hasExcessiveMentions = totalUniqueMentions >= 15;

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
                    } catch (deleteError) {
                        console.error('Failed to delete message:', deleteError);
                    }
                    
                    // Send warning with stats
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *Tagall Detected!*\n\n` +
                              `📍 *Mentions:* ${totalUniqueMentions} users\n` +
                              `📊 *Total Detected:* ${stats} messages\n` +
                              `🚫 *Action:* Message deleted`
                    });
                    
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
                            text: `🚫 *Antitag Detected!*\n\n` +
                                  `📍 *Mentions:* ${totalUniqueMentions} users\n` +
                                  `👤 *User:* @${senderId.split('@')[0]}\n` +
                                  `📊 *Total Detected:* ${stats} messages\n` +
                                  `⚡ *Action:* User kicked`,
                            mentions: [senderId]
                        });
                    } catch (kickError) {
                        console.error('Failed to kick user:', kickError);
                        await sock.sendMessage(chatId, {
                            text: `⚠️ *Tagall Detected!*\nFailed to kick user (insufficient permissions). Message was deleted.`
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

// Statistics management functions
function incrementGroupStats(chatId) {
    const stats = antitagStats.get(chatId) || { count: 0, lastReset: new Date() };
    stats.count++;
    antitagStats.set(chatId, stats);
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
