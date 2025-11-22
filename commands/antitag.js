const { setAntitag, getAntitag, removeAntitag } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const { getPrefix } = require('./setprefix');

async function handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        const prefix = getPrefix(); // Fixed: Added parentheses to call the function
        const args = userMessage.slice(prefix.length + 8).toLowerCase().trim().split(' '); // Fixed: dynamic slicing based on prefix
        const action = args[0];

        if (!action) {
            const usage = `ANTITAG SETUP\n\n🔹 ${prefix}antitag on\n🔹 ${prefix}antitag set delete | kick\n🔹 ${prefix}antitag off\n🔹 ${prefix}antitag get\n\n`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntitag(chatId);
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antitag is already on_*' }, { quoted: message });
                    return;
                }
                const result = await setAntitag(chatId, true, 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? '*_Antitag has been turned ON_*\n_Default action: delete message_' : '*_Failed to turn on Antitag_*' 
                }, { quoted: message });
                break;

            case 'off':
                await removeAntitag(chatId);
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
                
                // Check if antitag is enabled before setting action
                const currentConfig = await getAntitag(chatId);
                if (!currentConfig?.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: `*_Please enable antitag first using: ${prefix}antitag on_*` 
                    }, { quoted: message });
                    return;
                }
                
                const setResult = await setAntitag(chatId, true, setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `*_Antitag action set to: ${setAction}_*` : '*_Failed to set Antitag action_*' 
                }, { quoted: message });
                break;

            case 'get':
                const config = await getAntitag(chatId);
                const statusText = config?.enabled ? 'ON' : 'OFF';
                const actionText = config?.action || 'Not set';
                await sock.sendMessage(chatId, { 
                    text: `*_Antitag Configuration:_*\n• Status: ${statusText}\n• Action: ${actionText}` 
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*_Invalid command. Use ${prefix}antitag for usage._*` }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antitag command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antitag command_*' }, { quoted: message });
    }
}

async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        // Don't process if sender is admin
        const isAdminUser = await isAdmin(sock, chatId, senderId);
        if (isAdminUser) return;

        const antitagSetting = await getAntitag(chatId);
        if (!antitagSetting || !antitagSetting.enabled) return;

        // Extract mentions from message
        let mentions = [];
        
        // Check for mentions in extended text message
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
            mentions = message.message.extendedTextMessage.contextInfo.mentionedJid;
        }
        
        // Check for mentions in other message types
        if (message.message?.imageMessage?.contextInfo?.mentionedJid) {
            mentions = message.message.imageMessage.contextInfo.mentionedJid;
        }
        
        if (message.message?.videoMessage?.contextInfo?.mentionedJid) {
            mentions = message.message.videoMessage.contextInfo.mentionedJid;
        }
        
        // Remove empty/null values and duplicates
        mentions = mentions.filter(mention => mention && mention !== 'undefined').filter((value, index, self) => self.indexOf(value) === index);

        // If no mentions found, return
        if (mentions.length === 0) return;

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        
        // Calculate threshold (50% of group members)
        const mentionThreshold = Math.max(3, Math.ceil(participants.length * 0.5)); // Minimum 3 mentions
        
        // Check if mentions exceed threshold
        if (mentions.length >= mentionThreshold) {
            const action = antitagSetting.action || 'delete';
            
            if (action === 'delete') {
                // Try to delete the message
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
                
                // Send warning
                await sock.sendMessage(chatId, {
                    text: `⚠️ *Tagall Detected!*\n\nMessage has been deleted. Please avoid tagging multiple members.`,
                    mentions: [senderId]
                });
                
            } else if (action === 'kick') {
                // First try to delete the message
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
                    
                    // Send notification
                    await sock.sendMessage(chatId, {
                        text: `🚫 *Antitag Protection*\n\nUser has been removed for tagging multiple members.`,
                        mentions: [senderId]
                    });
                } catch (kickError) {
                    console.error('Failed to kick user:', kickError);
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *Antitag Violation Detected*\n\nFailed to remove user. Please contact admin.`,
                        mentions: [senderId]
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error in tag detection:', error);
    }
}

module.exports = {
    handleAntitagCommand,
    handleTagDetection
};
