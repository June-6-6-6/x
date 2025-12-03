const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const getPrefix = require('./setprefix');

// Store warn counts in memory
const warnCounts = new Map();

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, prefix) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'For Group Admins Only!' });
            return;
        }

        // Use provided prefix or fallback
        prefix = prefix || getPrefix();

        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `ANTILINK SETUP\n\n🔹${prefix}antilink on\n🔹${prefix}antilink set delete | kick | warn\n🔹${prefix}antilink setlimit <number>\n🔹${prefix}antilink off\n`;
            await sock.sendMessage(chatId, { text: usage });
            return;
        }

        switch (action) {
            case 'on': {
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig && existingConfig.enabled) {
                    await sock.sendMessage(chatId, { text: 'Antilink is already ON' });
                    return;
                }
                const result = await setAntilink(chatId, 'on', { enabled: true, action: 'warn' });
                await sock.sendMessage(chatId, { 
                    text: result ? 'Antilink has been turned ON (Default: Warn)' : 'Failed to turn on Antilink' 
                });
                break;
            }

            case 'off': {
                await removeAntilink(chatId, 'on');
                clearAllWarns(chatId);
                await sock.sendMessage(chatId, { text: 'Antilink has been turned OFF' });
                break;
            }

            case 'set': {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `Please specify an action: ${prefix}antilink set delete | kick | warn` 
                    });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: 'Invalid action. Choose delete, kick, or warn.' });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', { enabled: true, action: setAction });
                await sock.sendMessage(chatId, { 
                    text: setResult ? `Antilink action set to ${setAction}` : 'Failed to set Antilink action' 
                });
                break;
            }

            case 'setlimit': {
                if (args.length < 2 || isNaN(args[1])) {
                    await sock.sendMessage(chatId, { 
                        text: `Usage: ${prefix}antilink setlimit <number>\nExample: ${prefix}antilink setlimit 5` 
                    });
                    return;
                }
                const limit = parseInt(args[1]);
                if (limit < 1 || limit > 10) {
                    await sock.sendMessage(chatId, { text: 'Please set a limit between 1 and 10' });
                    return;
                }
                await setAntilink(chatId, 'limit', limit);
                await sock.sendMessage(chatId, { text: `Warn limit set to ${limit}` });
                break;
            }

            case 'get': {
                const statusConfig = await getAntilink(chatId, 'on');
                const actionConfig = statusConfig?.action || 'Not set';
                const userKey = `${chatId}:${senderId}`;
                const userWarns = getWarnCount(userKey);
                const warnLimit = await getAntilink(chatId, 'limit') || 3;
                
                await sock.sendMessage(chatId, { 
                    text: `Antilink Configuration:\nStatus: ${statusConfig?.enabled ? 'ON' : 'OFF'}\nAction: ${actionConfig}\nWarn Limit: ${warnLimit}\nYour Warns: ${userWarns}/${warnLimit}` 
                });
                break;
            }

            default:
                await sock.sendMessage(chatId, { text: `Use ${prefix}antilink for usage.` });
        }
    } catch (error) {
        console.error('Error in antilink command:', error.message, error.stack);
        await sock.sendMessage(chatId, { text: 'Error processing antilink command' });
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    const antilinkSetting = await getAntilink(chatId, 'on');
    if (!antilinkSetting?.enabled) return;

    const linkPatterns = {
        whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
        whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
        telegram: /t\.me\/[A-Za-z0-9_]+/,
        allLinks: /https?:\/\/[^\s]+/,
    };

    let linkDetected = false;
    let linkType = null;

    for (const [type, pattern] of Object.entries(linkPatterns)) {
        if (pattern.test(userMessage)) {
            linkDetected = true;
            linkType = type;
            break;
        }
    }

    if (!linkDetected) return;

    const userKey = `${chatId}:${senderId}`;
    const action = antilinkSetting.action || 'delete';
    const warnLimit = await getAntilink(chatId, 'limit') || 3;
    
    switch (action) {
        case 'delete':
            await deleteMessage(sock, chatId, message, senderId);
            break;
        case 'warn': {
            const warnCount = incrementWarnCount(userKey);
            await sendWarning(sock, chatId, senderId, warnCount, warnLimit);
            if (warnCount >= warnLimit) {
                await takeAction(sock, chatId, senderId, 'kick');
                resetWarnCount(userKey);
            }
            break;
        }
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
    for (const key of warnCounts.keys()) {
        if (key.startsWith(`${chatId}:`)) {
            warnCounts.delete(key);
        }
    }
}

async function deleteMessage(sock, chatId, message, senderId) {
    try {
        await sock.sendMessage(chatId, { delete: message.key });
        await sock.sendMessage(chatId, { 
            text: `@${senderId.split('@')[0]}, your link was deleted. No links allowed!`, 
            mentions: [senderId] 
        });
    } catch (error) {
        console.error('Failed to delete message:', error.message);
    }
}

async function sendWarning(sock, chatId, senderId, currentWarns, warnLimit) {
    const warningsLeft = warnLimit - currentWarns;
    let warningText = `⚠️ Warning @${senderId.split('@')[0]}! Posting links is not allowed. This is warning ${currentWarns}/${warnLimit}. `;
    warningText += warningsLeft > 0 ? `${warningsLeft} warning(s) left before action.` : 'Action will be taken now.';
    
    await sock.sendMessage(chatId, { text: warningText, mentions: [senderId] });
}

async function takeAction(sock, chatId, senderId, action) {
    if (action === 'kick') {
        await kickUser(sock, chatId, senderId);
    } else {
        await sock.sendMessage(chatId, { 
            text: `@${senderId.split('@')[0]}, you've reached the warning limit! Further links will result in removal.`, 
            mentions: [senderId] 
        });
    }
}

async function kickUser(sock, chatId, senderId) {
    try {
        await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
        await sock.sendMessage(chatId, { 
            text: `@${senderId.split('@')[0]} has been removed for posting links.`, 
            mentions: [senderId] 
        });
    } catch (error) {
        console.error('Failed to remove user:', error.message);
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
    resetWarnCount
            }
