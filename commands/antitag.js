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
        // Fixed: Use dynamic prefix length instead of hardcoded 9
        const commandBody = userMessage.slice(prefix.length + 'antitag'.length).trim();
        const args = commandBody.toLowerCase().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `\`\`\`ANTITAG SETUP\n\n${prefix}antitag on\n${prefix}antitag set delete | kick\n${prefix}antitag off\n${prefix}antitag stats\n\`\`\``;
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on':
            case 'enable':
            case 'activate':
                const existingConfig = await getAntitag(chatId);
                // FIXED: Better check for existing config
                if (existingConfig && existingConfig.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antitag is already ON_*' }, { quoted: message });
                    return;
                }
                
                // FIXED: Create proper config object with default action
                const config = { 
                    enabled: true, 
                    action: existingConfig?.action || 'delete' // Use existing action or default to 'delete'
                };
                
                // FIXED: Ensure setAntitag is called correctly
                const result = await setAntitag(chatId, config);
                
                if (result) {
                    await sock.sendMessage(chatId, { 
                        text: '*_✅ Antitag has been turned ON_*\n' +
                              `*Action:* ${config.action}\n` +
                              '*_Mass mentions will now be automatically detected and handled._*'
                    }, { quoted: message });
                    
                    // Initialize stats if not exists
                    if (!antitagStats.has(chatId)) {
                        antitagStats.set(chatId, { count: 0, lastReset: new Date() });
                    }
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '*_❌ Failed to turn on Antitag_*' 
                    }, { quoted: message });
                }
                break;

            case 'off':
            case 'disable':
            case 'deactivate':
                // FIXED: Use correct function signature and check result
                const removeResult = await removeAntitag(chatId);
                if (removeResult) {
                    await sock.sendMessage(chatId, { 
                        text: '*_🔴 Antitag has been turned OFF_*' 
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '*_Antitag was already OFF or failed to turn off_*' 
                    }, { quoted: message });
                }
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
                
                // FIXED: Get current config and update it properly
                const currentConfig = await getAntitag(chatId) || {};
                const updatedConfig = { 
                    ...currentConfig, 
                    enabled: true, // Automatically enable when setting action
                    action: setAction 
                };
                
                const setResult = await setAntitag(chatId, updatedConfig);
                
                if (setResult) {
                    await sock.sendMessage(chatId, { 
                        text: `*_✅ Antitag action set to ${setAction}_*\n` +
                              '*_Antitag is now enabled with this action._*'
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: '*_❌ Failed to set Antitag action_*' 
                    }, { quoted: message });
                }
                break;

            case 'get':
            case 'status':
                const status = await getAntitag(chatId);
                const stats = getGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: `*_🛡️ Antitag Configuration:_*\n` +
                          `*Status:* ${status?.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                          `*Action:* ${status?.action || 'delete'}\n` +
                          `*Total Detected:* ${stats || 0} messages`
                }, { quoted: message });
                break;

            case 'stats':
            case 'info':
                const config = await getAntitag(chatId);
                const groupStats = getGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: `*_📊 ANTITAG STATISTICS_*\n\n` +
                          `🔹 *Status:* ${config?.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                          `🔹 *Action:* ${config?.action || 'delete'}\n` +
                          `🔹 *Total Detected:* ${groupStats || 0} messages\n` +
                          `🔹 *Last Reset:* ${getLastResetTime(chatId)}` 
                }, { quoted: message });
                break;

            case 'reset':
            case 'clear':
                resetGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: '*_📊 Antitag statistics have been reset_*' 
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antitag for usage._*` }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antitag command:', error);
        await sock.sendMessage(chatId, { text: '*_❌ Error processing antitag command_*' }, { quoted: message });
    }
}

// The rest of your functions remain the same...
async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        // FIXED: Get antitag setting without second parameter
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
                            text: `⚠️ *Tagall Detected!*\n\n` +
                                  `📍 *Mentions:* ${totalUniqueMentions} users\n` +
                                  `📊 *Total Detected:* ${stats} messages\n` +
                                  `🚫 *Action:* Message deleted`
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
