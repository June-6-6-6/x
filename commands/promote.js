const { isAdmin } = require('../lib/isAdmin');

// Function to handle manual promotions via command
async function promoteCommand(sock, chatId, mentionedJids, message) {
    let userToPromote = [];
    
    // Check for mentioned users
    if (mentionedJids && mentionedJids.length > 0) {
        userToPromote = mentionedJids;
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToPromote = [message.message.extendedTextMessage.contextInfo.participant];
    }
    
    // If no user found through either method
    if (userToPromote.length === 0) {
        await sock.sendMessage(chatId, { 
            text: 'Please mention the user or reply to their message to promote!'
        });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, userToPromote, "promote");
        
        // Get usernames for promoted users
        const promotedUsers = userToPromote.map(jid => `@${jid.split('@')[0]}`).join(', ');
        
        // Get promoter info - fix: ensure proper JID format for mention
        const promoterJid = sock.user.id;
        const promoterMention = `@${promoterJid.split('@')[0]}`;

        // Simple notification - only bot sends this
        const promotionMessage = `🎊 Promoted: ${promotedUsers}\n👤 By: ${promoterMention}`;
        
        // Fix: Include promoter JID in mentions array
        await sock.sendMessage(chatId, { 
            text: promotionMessage,
            mentions: [...userToPromote, promoterJid]
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
        if (!Array.isArray(participants) || participants.length === 0) {
            return;
        }

        // Get bot JID
        const botJid = sock.user.id;
        const authorJid = typeof author === 'string' ? author : (author?.id || author?.toString());
        
        // ONLY send notification if the promotion was done by the bot
        if (authorJid !== botJid) {
            return; // Silent return - no notification for other admins
        }

        // Get promoted users and their JIDs for mentions
        const promotedUsers = participants.map(jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            return `@${jidString.split('@')[0]}`;
        }).join(', ');

        const promoterMention = `@${botJid.split('@')[0]}`;

        // Simple notification - only for bot actions
        const promotionMessage = `🤖 Bot Promotion\n🎊 Promoted: ${promotedUsers}\n👤 By: ${promoterMention}`;
        
        // Fix: Convert all participant JIDs to string format and include bot JID
        const mentionList = participants.map(jid => 
            typeof jid === 'string' ? jid : (jid.id || jid.toString())
        );

        await sock.sendMessage(groupId, {
            text: promotionMessage,
            mentions: [...mentionList, botJid] // Include bot JID for mention
        });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}

module.exports = { promoteCommand, handlePromotionEvent };
