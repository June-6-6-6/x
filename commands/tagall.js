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

        // Send initial processing message
        await sock.sendMessage(chatId, {
            text: `⏳ Processing tagall for ${participants.length} members...`
        });

        // Handle different group sizes with optimized chunking
        if (participants.length <= 100) {
            // Small groups: single message
            await sendSingleTagAllMessage(sock, chatId, participants, groupMetadata);
        } else if (participants.length <= 512) {
            // Medium groups: split into 2 chunks
            await sendOptimizedTagAllMessages(sock, chatId, participants, groupMetadata, 2);
        } else {
            // Large groups (513+): split into 2 chunks only (as requested)
            await sendOptimizedTagAllMessages(sock, chatId, participants, groupMetadata, 2);
        }

        // Send completion message
        await sock.sendMessage(chatId, {
            text: `✅ Successfully tagged all ${participants.length} members in 2 rounds!`
        });

    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to tag all members. Please try again later.' 
        });
    }
}

// Function to send single message for small groups (up to 100 members)
async function sendSingleTagAllMessage(sock, chatId, participants, groupMetadata) {
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

    await sock.sendMessage(chatId, {
        text: message,
        mentions: participants.map(p => p.id)
    });
}

// Optimized function to send messages in exactly 2 rounds for any group size
async function sendOptimizedTagAllMessages(sock, chatId, participants, groupMetadata, rounds = 2) {
    const totalMembers = participants.length;
    const membersPerRound = Math.ceil(totalMembers / rounds);
    
    // Send header message
    let headerMessage = `🏷️ *TAGGING ALL MEMBERS* 🏷️\n\n`;
    headerMessage += `📛 *Group Name:* ${groupMetadata.subject}\n`;
    headerMessage += `👥 *Total Members:* ${totalMembers}\n`;
    headerMessage += `📅 *Created:* ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}\n\n`;
    headerMessage += `🔊 *Tagging ${totalMembers} members in ${rounds} rounds...*\n`;

    await sock.sendMessage(chatId, { text: headerMessage });

    // Send members in specified number of rounds
    for (let round = 0; round < rounds; round++) {
        const startIdx = round * membersPerRound;
        const endIdx = Math.min(startIdx + membersPerRound, totalMembers);
        const roundParticipants = participants.slice(startIdx, endIdx);
        
        let roundMessage = `🔄 *Round ${round + 1}/${rounds}*\n`;
        roundMessage += `👥 Members ${startIdx + 1}-${endIdx} (${roundParticipants.length} members)\n\n`;
        
        // For very large groups, we'll use a more compact format
        if (roundParticipants.length > 100) {
            roundMessage += `📋 Tagging ${roundParticipants.length} members in this round...\n\n`;
        } else {
            roundParticipants.forEach((participant, indexInRound) => {
                const globalIndex = startIdx + indexInRound;
                const number = (globalIndex + 1).toString().padStart(totalMembers > 99 ? 3 : 2, '0');
                const username = participant.id.split('@')[0];
                const adminIndicator = participant.admin ? ' 👑' : '';
                
                roundMessage += `${number}. @${username}${adminIndicator}\n`;
            });
        }

        roundMessage += `\n📊 Progress: ${Math.round(((round + 1) / rounds) * 100)}% (${endIdx}/${totalMembers} members)`;

        try {
            await sock.sendMessage(chatId, {
                text: roundMessage,
                mentions: roundParticipants.map(p => p.id)
            });
        } catch (roundError) {
            console.log(`Error sending round ${round + 1}:`, roundError.message);
            // Continue with next round even if one fails
        }

        // Add delay between rounds to avoid spamming
        if (round < rounds - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
    }
}

module.exports = tagAllCommand;
