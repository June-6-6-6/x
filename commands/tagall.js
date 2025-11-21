const isAdmin = require('../lib/isAdmin');

async function tagAllCommand(sock, chatId, senderId, messageText = '') {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Only admins can use the .tagall command.'
            });
            return;
        }

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Bot needs admin permissions to use .tagall command.'
            });
            return;
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { text: '❌ No participants found in the group.' });
            return;
        }

        // Get group profile picture
        let profilePictureUrl = null;
        try {
            profilePictureUrl = await sock.profilePictureUrl(chatId);
        } catch (error) {
            console.log('Could not fetch group profile picture:', error.message);
            // Continue without profile picture
        }

        // Extract custom message from command (if any)
        const customMessage = messageText.replace(/^\.tagall\s*/, '').trim();
        
        // Separate admins and regular members
        const admins = participants.filter(p => p.admin || p.isAdmin);
        const regularMembers = participants.filter(p => !p.admin && !p.isAdmin);

        // Prepare the message with group info
        let message = `🏷️ *GROUP MENTION* 🏷️\n\n`;
        message += `📛 *Group Name:* ${groupMetadata.subject}\n`;
        message += `👥 *Total Members:* ${participants.length}\n`;
        message += `👑 *Admins:* ${admins.length}\n`;
        message += `👤 *Members:* ${regularMembers.length}\n`;
        
        // Safely handle creation date
        const creationDate = groupMetadata.creation ? new Date(groupMetadata.creation * 1000).toLocaleDateString() : 'Unknown';
        message += `📅 *Created:* ${creationDate}\n\n`;

        // Add custom message if provided
        if (customMessage) {
            message += `💬 *Message:* ${customMessage}\n\n`;
        }

        message += `🔊 *MENTIONING ALL MEMBERS*\n\n`;

        // Add admins section
        if (admins.length > 0) {
            message += `👑 *ADMINS (${admins.length})*:\n`;
            admins.forEach((admin, index) => {
                const number = (index + 1).toString().padStart(2, '0');
                const username = admin.id.split('@')[0];
                const displayName = admin.name || admin.notify || `User${number}`;
                message += `${number}. @${username} (${displayName})\n`;
            });
            message += '\n';
        }

        // Add regular members section
        if (regularMembers.length > 0) {
            message += `👤 *MEMBERS (${regularMembers.length})*:\n`;
            regularMembers.forEach((member, index) => {
                const number = (index + 1).toString().padStart(2, '0');
                const username = member.id.split('@')[0];
                const displayName = member.name || member.notify || `User${number}`;
                message += `${number}. @${username} (${displayName})\n`;
            });
        }

        // Create mentions array for all participants
        const allMentions = participants.map(p => p.id);

        // Prepare message options
        const messageOptions = {
            text: message,
            mentions: allMentions
        };

        // Add profile picture if available
        if (profilePictureUrl) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: profilePictureUrl },
                    caption: message,
                    mentions: allMentions
                });
                return;
            } catch (imageError) {
                console.log('Failed to send with image, sending text only:', imageError.message);
                await sock.sendMessage(chatId, messageOptions);
            }
        } else {
            await sock.sendMessage(chatId, messageOptions);
        }

        // Send additional tagging message if custom message is provided
        if (customMessage) {
            setTimeout(async () => {
                try {
                    const tagMessage = `📢 *Announcement:* ${customMessage}\n\n` +
                                     `🔔 *Tagging all ${participants.length} members:*\n` +
                                     participants.map(p => `@${p.id.split('@')[0]}`).join(' ');
                    
                    await sock.sendMessage(chatId, {
                        text: tagMessage,
                        mentions: allMentions
                    });
                } catch (tagError) {
                    console.log('Error sending tag message:', tagError.message);
                }
            }, 1000);
        }

    } catch (error) {
        console.error('Error in tagall command:', error);
        
        let errorMessage = '❌ Failed to tag all members. Please try again later.';
        if (error.message.includes('not authorized') || error.message.includes('permission')) {
            errorMessage = '❌ Bot does not have permission to perform this action.';
        } else if (error.message.includes('group') || error.message.includes('chat')) {
            errorMessage = '❌ Could not access group information.';
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        });
    }
}

// Additional function for quick tagging without detailed list
async function quickTagAll(sock, chatId, senderId, customMessage = '') {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin || !isBotAdmin) {
            return false;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            return false;
        }

        const allMentions = participants.map(p => p.id);
        const message = customMessage ? 
            `📢 ${customMessage}\n\n👥 Tagging all ${participants.length} members:\n${participants.map(p => `@${p.id.split('@')[0]}`).join(' ')}` :
            `🔔 *Attention all ${participants.length} members!* \n\n${participants.map(p => `@${p.id.split('@')[0]}`).join(' ')}`;

        await sock.sendMessage(chatId, {
            text: message,
            mentions: allMentions
        });

        return true;

    } catch (error) {
        console.error('Error in quickTagAll:', error);
        return false;
    }
}

module.exports = {
    tagAllCommand,
    quickTagAll
};
