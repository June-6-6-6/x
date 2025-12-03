const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

/**
 * Handle Antilink Command
 */
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'For Group Admins Only!' });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `ANTILINK SETUP\n\n🔹${prefix}antilink on\n🔹${prefix}antilink set delete | kick | warn\n🔹${prefix}antilink off\n🔹${prefix}antilink get\n`;
            await sock.sendMessage(chatId, { text: usage });
            return;
        }

        switch (action) {
            case 'on': {
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antilink is already ON_*' });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? '*_Antilink has been turned ON_*' : '*_Failed to turn ON Antilink_*' 
                });
                break;
            }

            case 'off': {
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, { text: '*_Antilink has been turned OFF_*' });
                break;
            }

            case 'set': {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `*_Please specify an action: ${prefix}antilink set delete | kick | warn_*` 
                    });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: '*_Invalid action. Choose delete, kick, or warn._*' });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `*_Antilink action set to ${setAction}_*` : '*_Failed to set Antilink action_*' 
                });
                break;
            }

            case 'get': {
                const status = await getAntilink(chatId, 'on');
                const actionConfig = await getAntilink(chatId, 'on');
                await sock.sendMessage(chatId, { 
                    text: `*_Antilink Configuration:_*\nStatus: ${status ? 'ON' : 'OFF'}\nAction: ${actionConfig ? actionConfig.action : 'Not set'}` 
                });
                break;
            }

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antilink for usage._*` });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antilink command_*' });
    }
}

/**
 * Handle Link Detection
 */
async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    const antilinkConfig = await getAntilink(chatId, 'on');
    if (!antilinkConfig?.enabled) return;

    console.log(`Antilink Setting for ${chatId}: ${antilinkConfig.action}`);
    console.log(`Checking message for links: ${userMessage}`);
    console.log("Full message object: ", JSON.stringify(message, null, 2));

    // ✅ Skip admins
    const senderIsAdmin = await isAdmin(sock, chatId, senderId);
    if (senderIsAdmin) {
        console.log(`Sender ${senderId} is an admin. Skipping antilink enforcement.`);
        return;
    }

    const linkPatterns = {
        whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
        whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
        telegram: /t\.me\/[A-Za-z0-9_]+/,
        allLinks: /https?:\/\/[^\s]+/,
    };

    let detected = false;
    if (linkPatterns.whatsappGroup.test(userMessage)) detected = true;
    else if (linkPatterns.whatsappChannel.test(userMessage)) detected = true;
    else if (linkPatterns.telegram.test(userMessage)) detected = true;
    else if (linkPatterns.allLinks.test(userMessage)) detected = true;

    if (!detected) {
        console.log('No link detected.');
        return;
    }

    const quotedMessageId = message.key.id;
    const quotedParticipant = message.key.participant || senderId;

    try {
        if (antilinkConfig.action === 'delete') {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant },
            });
            console.log(`Message with ID ${quotedMessageId} deleted successfully.`);
        } else if (antilinkConfig.action === 'kick') {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            console.log(`User ${senderId} kicked for posting link.`);
        } else if (antilinkConfig.action === 'warn') {
            const mentionedJidList = [senderId];
            await sock.sendMessage(chatId, { 
                text: `⚠️ Warning! @${senderId.split('@')[0]}, posting links is not allowed.`, 
                mentions: mentionedJidList 
            });
            console.log(`User ${senderId} warned for posting link.`);
        }
    } catch (error) {
        console.error('Failed to enforce antilink action:', error);
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
};
