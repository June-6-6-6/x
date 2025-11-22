const { isAdmin } = require('../lib/isAdmin');

// Function to handle manual promotions via command
async function promoteCommand(sock, chatId, mentionedJids, message) {
    let userToPromote = [];
    
    // Check for mentioned users
    if (mentionedJids?.length > 0) {
        userToPromote = mentionedJids;
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToPromote = [message.message.extendedTextMessage.contextInfo.participant];
    }
    
    // If no user found
    if (userToPromote.length === 0) {
        await sock.sendMessage(chatId, { 
            text: 'Please mention the user or reply to their message to promote!'
        });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, userToPromote, "promote");
        
        // Simple notification - only 2 items
        const promotedUsers = userToPromote.map(jid => `@${jid.split('@')[0]}`).join(', ');
        const promoter = `@${sock.user.id.split('@')[0]}`;
        
        const promotionMessage = `🎊 Promoted: ${promotedUsers}\n👤 By: ${promoter}`;
        
        await sock.sendMessage(chatId, { 
            text: promotionMessage,
            mentions: [...userToPromote, sock.user.id]
        });
    } catch (error) {
        console.error('Error in promote command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to promote user(s)!'});
    }
}

// Function to handle automatic promotion detection
async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        // Safety check
        if (!Array.isArray(participants) || participants.length === 0) return;

        // Get bot JID
        const botJid = sock.user.id;
        const authorJid = typeof author === 'string' ? author : (author?.id || '');
        
        // Only send notification if promoted by the bot
        if (authorJid !== botJid) return;

        // Simple notification - only 2 items
        const promotedUsers = participants.map(jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || '');
            return `@${jidString.split('@')[0]}`;
        }).join(', ');

        const promoter = `@${botJid.split('@')[0]}`;
        
        const promotionMessage = `🎊 Promoted: ${promotedUsers}\n👤 By: ${promoter}`;
        
        const mentionList = participants.map(jid => 
            typeof jid === 'string' ? jid : (jid.id || '')
        );

        await sock.sendMessage(groupId, {
            text: promotionMessage,
            mentions: [...mentionList, botJid]
        });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}

module.exports = { promoteCommand, handlePromotionEvent };
