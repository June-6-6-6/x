const isAdmin = require('../lib/isAdmin');

async function tagAllCommand(sock, chatId, senderId) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin && !isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Only admins can use the .tagall command.'
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

        // Check if group is too large
        if (participants.length > 1024) {
            await sock.sendMessage(chatId, { 
                text: `❌ Group too large! This command supports up to 1024 members, but this group has ${participants.length} members.` 
            });
            return;
        }

        // Get group profile picture
        let profilePictureUrl = null;
        try {
            const ppUrl = await sock.profilePictureUrl(chatId, 'image');
            profilePictureUrl = ppUrl;
        } catch (error) {
            console.log('Could not fetch group profile picture:', error.message);
            // Continue without profile picture
        }

        // Send initial processing message
        await sock.sendMessage(chatId, {
            text: `⏳ Processing tagall for ${participants.length} members...`
        });

        // Handle different group sizes with appropriate chunking
        if (participants.length <= 50) {
            // Small groups: single message
            await sendSingleTagAllMessage(sock, chatId, participants, groupMetadata, profilePictureUrl);
        } else if (participants.length <= 200) {
            // Medium groups: split into chunks
            await sendChunkedTagAllMessages(sock, chatId, participants, groupMetadata, 25);
        } else if (participants.length <= 500) {
            // Large groups: smaller chunks
            await sendChunkedTagAllMessages(sock, chatId, participants, groupMetadata, 15);
        } else {
            // Very large groups: smallest chunks
            await sendChunkedTagAllMessages(sock, chatId, participants, groupMetadata, 10);
        }

        // Send completion message
        await sock.sendMessage(chatId, {
            text: `✅ Successfully tagged all ${participants.length} members!`
        });

    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to tag all members. Please try again later.' 
        });
    }
}

// Function to send single message for small groups (up to 50 members)
async function sendSingleTagAllMessage(sock, chatId, participants, groupMetadata, profilePictureUrl) {
    let message = `🏷️ *TAGGING ALL MEMBERS* 🏷️\n\n`;
    message += `📛 *Group Name:* ${groupMetadata.subject}\n`;
    message += `👥 *Total Members:* ${participants.length}\n`;
    message += `📅 *Created:* ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}\n\n`;
    message += `🔊 *Members List:*\n\n`;

    // Add participants with numbering
    participants.forEach((participant, index) => {
        const number = (index + 1).toString().padStart(participants.length > 9 ? 2 : 1, '0');
        const username = participant.id.split('@')[0];
        const adminIndicator = participant.admin ? ' 👑' : '';
        
        message += `${number}. @${username}${adminIndicator}\n`;
    });

    const messageOptions = {
        text: message,
        mentions: participants.map(p => p.id)
    };

    // Add profile picture if available
    if (profilePictureUrl) {
        try {
            await sock.sendMessage(chatId, {
                image: { url: profilePictureUrl },
                caption: message,
                mentions: participants.map(p => p.id)
            });
            return;
        } catch (imageError) {
            console.log('Failed to send with image, sending text only:', imageError.message);
        }
    }
    
    await sock.sendMessage(chatId, messageOptions);
}

// Function to send chunked messages for larger groups
async function sendChunkedTagAllMessages(sock, chatId, participants, groupMetadata, chunkSize) {
    const totalChunks = Math.ceil(participants.length / chunkSize);
    
    // Send header message
    let headerMessage = `🏷️ *TAGGING ALL MEMBERS* 🏷️\n\n`;
    headerMessage += `📛 *Group Name:* ${groupMetadata.subject}\n`;
    headerMessage += `👥 *Total Members:* ${participants.length}\n`;
    headerMessage += `📅 *Created:* ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}\n\n`;
    headerMessage += `🔊 *Tagging ${participants.length} members in ${totalChunks} parts...*\n`;

    await sock.sendMessage(chatId, { text: headerMessage });

    // Send members in chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const startIdx = chunkIndex * chunkSize;
        const endIdx = Math.min(startIdx + chunkSize, participants.length);
        const chunkParticipants = participants.slice(startIdx, endIdx);
        
        let chunkMessage = `📋 *Part ${chunkIndex + 1}/${totalChunks}*\n`;
        chunkMessage += `👥 Members ${startIdx + 1}-${endIdx}\n\n`;
        
        chunkParticipants.forEach((participant, indexInChunk) => {
            const globalIndex = startIdx + indexInChunk;
            const number = (globalIndex + 1).toString().padStart(participants.length > 99 ? 3 : 2, '0');
            const username = participant.id.split('@')[0];
            const adminIndicator = participant.admin ? ' 👑' : '';
            
            chunkMessage += `${number}. @${username}${adminIndicator}\n`;
        });

        // Add progress for very large groups
        if (totalChunks > 10) {
            const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
            chunkMessage += `\n📊 Progress: ${progress}% (${chunkIndex + 1}/${totalChunks})`;
        }

        try {
            await sock.sendMessage(chatId, {
                text: chunkMessage,
                mentions: chunkParticipants.map(p => p.id)
            });
        } catch (chunkError) {
            console.log(`Error sending chunk ${chunkIndex + 1}:`, chunkError.message);
            // Continue with next chunk even if one fails
        }

        // Add delay between chunks to avoid rate limiting
        if (chunkIndex < totalChunks - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

module.exports = tagAllCommand;
