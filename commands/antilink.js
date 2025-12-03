const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

// Store warn counts in memory
const warnCounts = new Map();

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, prefix) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'For Group Admins Only!' });
            return;
        }

        const prefix = getPrefix();
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `ANTILINK SETUP\n\n🔹${prefix}antilink on\n🔹${prefix}antilink set delete | kick | warn\n🔹${prefix}antilink setlimit <number>\n🔹${prefix}antilink off\n`;
            await sock.sendMessage(chatId, { text: usage });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: 'Antilink is already on' });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'warn');
                await sock.sendMessage(chatId, { 
                    text: result ? 'Antilink has been turned ON (Default: Warn)' : 'Failed to turn on Antilink' 
                });
                break;

            case 'off':
                await removeAntilink(chatId, 'on');
                clearAllWarns(chatId);
                await sock.sendMessage(chatId, { text: 'Antilink has been turned OFF' });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `Please specify an action: ${prefix}antilink set delete | kick | warn` 
                    });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { 
                        text: 'Invalid action. Choose delete, kick, or warn.' 
                    });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `Antilink action set to ${setAction}` : 'Failed to set Antilink action' 
                });
                break;

            case 'setlimit':
                if (args.length < 2 || isNaN(args[1])) {
                    await sock.sendMessage(chatId, { 
                        text: `Usage: ${prefix}antilink setlimit <number>\nExample: .antilink setlimit 5` 
                    });
                    return;
                }
                
                const limit = parseInt(args[1]);
                if (limit < 1 || limit > 10) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please set a limit between 1 and 10' 
                    });
                    return;
                }
                
                // Store limit in memory or extend your existing setAntilink function
                await setAntilink(chatId, 'limit', limit);
                await sock.sendMessage(chatId, { 
                    text: `Warn limit set to ${limit}` 
                });
                break;

            case 'get':
                const status = await getAntilink(chatId, 'on');
                const actionConfig = await getAntilink(chatId, 'on');
                const userKey = `${chatId}:${senderId}`;
                const userWarns = getWarnCount(userKey);
                const warnLimit = await getAntilink(chatId, 'limit') || 3;
                
                await sock.sendMessage(chatId, { 
                    text: `Antilink Configuration:\nStatus: ${status ? 'ON' : 'OFF'}\nAction: ${actionConfig ? actionConfig.action : 'Not set'}\nWarn Limit: ${warnLimit}\nYour Warns: ${userWarns}/${warnLimit}` 
                });
                break;

            default:
                await sock.sendMessage(chatId, { text: `Use ${prefix}antilink for usage.` });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: 'Error processing antilink command' });
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    const antilinkSetting = await getAntilink(chatId, 'on');
    if (!antilinkSetting?.enabled) return;

    console.log(`Antilink Setting for ${chatId}:`, antilinkSetting);
    console.log(`Checking message for links: ${userMessage}`);
    
    // Log the full message object to diagnose message structure
    console.log("Full message object: ", JSON.stringify(message, null, 2));

    const linkPatterns = {
        whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
        whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
        telegram: /t\.me\/[A-Za-z0-9_]+/,
        allLinks: /https?:\/\/[^\s]+/,
    };

    // Check for any link pattern
    let linkDetected = false;
    let linkType = null;

    for (const [type, pattern] of Object.entries(linkPatterns)) {
        if (pattern.test(userMessage)) {
            linkDetected = true;
            linkType = type;
            break;
        }
    }

    if (!linkDetected) {
        console.log('No link detected');
        return;
    }

    console.log(`Detected ${linkType} link from ${senderId}`);
    
    const userKey = `${chatId}:${senderId}`;
    const action = antilinkSetting.action || 'delete';
    const warnLimit = await getAntilink(chatId, 'limit') || 3;
    
    // Handle based on current action
    switch (action) {
        case 'delete':
            await deleteMessage(sock, chatId, message, senderId);
            break;
            
        case 'warn':
            const warnCount = incrementWarnCount(userKey);
            await sendWarning(sock, chatId, senderId, warnCount, warnLimit);
            
            // If warn limit reached, take action
            if (warnCount >= warnLimit) {
                await takeAction(sock, chatId, senderId, 'kick');
                resetWarnCount(userKey);
            }
            break;
            
        case 'kick':
            await kickUser(sock, chatId, senderId);
            break;
    }
}

// Helper functions
function getWarnCount(userKey) {
    return warnCounts.get(userKey) || 0;
}

function incrementWarnCount(userKey) {
    const current = getWarnCount(userKey);
    warnCounts.set(userKey, current + 1);
    return current + 1;
}

function resetWarnCount(userKey) {
    warnCounts.delete(userKey);
}

function clearAllWarns(chatId) {
    // Clear all warns for this chat
    for (const [key, _] of warnCounts.entries()) {
        if (key.startsWith(`${chatId}:`)) {
            warnCounts.delete(key);
        }
    }
}

async function deleteMessage(sock, chatId, message, senderId) {
    try {
        const quotedMessageId = message.key.id;
        const quotedParticipant = message.key.participant || senderId;

        console.log(`Attempting to delete message with id: ${quotedMessageId} from participant: ${quotedParticipant}`);

        await sock.sendMessage(chatId, {
            delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant },
        });
        
        console.log(`Message with ID ${quotedMessageId} deleted successfully.`);
        
        const mentionedJidList = [senderId];
        await sock.sendMessage(chatId, { 
            text: `@${senderId.split('@')[0]}, your link was deleted. No links allowed!`, 
            mentions: mentionedJidList 
        });
    } catch (error) {
        console.error('Failed to delete message:', error);
    }
}

async function sendWarning(sock, chatId, senderId, currentWarns, warnLimit) {
    const warningsLeft = warnLimit - currentWarns;
    
    let warningText = `⚠️ Warning @${senderId.split('@')[0]}! `;
    warningText += `Posting links is not allowed. `;
    warningText += `This is warning ${currentWarns}/${warnLimit}. `;
    
    if (warningsLeft > 0) {
        warningText += `${warningsLeft} warning(s) left before action.`;
    } else {
        warningText += 'Action will be taken now.';
    }
    
    await sock.sendMessage(chatId, { 
        text: warningText, 
        mentions: [senderId] 
    });
}

async function takeAction(sock, chatId, senderId, action) {
    if (action === 'kick') {
        await kickUser(sock, chatId, senderId);
    } else if (action === 'delete') {
        // For delete action at limit, just send final warning
        await sock.sendMessage(chatId, { 
            text: `@${senderId.split('@')[0]}, you've reached the warning limit! Further links will result in removal.`, 
            mentions: [senderId] 
        });
    }
}

async function kickUser(sock, chatId, senderId) {
    try {
        // Try to remove user from group
        await sock.groupParticipantsUpdate(
            chatId,
            [senderId],
            'remove'
        );
        
        await sock.sendMessage(chatId, { 
            text: `@${senderId.split('@')[0]} has been removed for posting links.`, 
            mentions: [senderId] 
        });
        
        console.log(`User ${senderId} removed from group ${chatId}`);
    } catch (error) {
        console.error('Failed to remove user:', error);
        await sock.sendMessage(chatId, { 
            text: `Could not remove @${senderId.split('@')[0]}. Make sure I'm an admin.`, 
            mentions: [senderId] 
        });
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
    getWarnCount,
    incrementWarnCount,
    resetWarnCount,
    clearAllWarns
};
