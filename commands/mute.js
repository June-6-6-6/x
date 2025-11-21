const isAdmin = require('../lib/isAdmin');

async function muteCommand(sock, chatId, senderId, message, durationInMinutes) {
    

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
        return;
    }

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: 'Only group admins can use the mute command.' }, { quoted: message });
        return;
    }

    try {
        let groupName = "the group";
        
        // Try to get group metadata to get the group name
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            groupName = groupMetadata.subject || "the group";
        } catch (metadataError) {
            console.error('Error fetching group metadata:', metadataError);
            // Continue with default group name if metadata fetch fails
        }

        // Mute the group
        await sock.groupSettingUpdate(chatId, 'announcement');
        
        if (durationInMinutes !== undefined && durationInMinutes > 0) {
            const durationInMilliseconds = durationInMinutes * 60 * 1000;
            await sock.sendMessage(chatId, { text: `🔇 ${groupName} has been muted for ${durationInMinutes} minutes.` }, { quoted: message });
            
            // Store the timeout reference to prevent memory leaks
            const unmuteTimeout = setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, { text: `🔊 ${groupName} has been unmuted automatically.` });
                } catch (unmuteError) {
                    console.error('Error unmuting group:', unmuteError);
                    try {
                        await sock.sendMessage(chatId, { text: `❌ Failed to automatically unmute ${groupName}. Please unmute manually.` });
                    } catch (sendError) {
                        console.error('Error sending unmute failure message:', sendError);
                    }
                }
            }, durationInMilliseconds);

            // Optional: Store the timeout reference if you need to clear it later
            // You might want to store this in a Map or object for management
            // timeoutReferences.set(chatId, unmuteTimeout);

        } else {
            await sock.sendMessage(chatId, { text: `🔇 ${groupName} has been muted.` }, { quoted: message });
        }
    } catch (error) {
        console.error('Error muting/unmuting the group:', error);
        await sock.sendMessage(chatId, { text: '❌ An error occurred while muting the group. Please try again.' }, { quoted: message });
    }
}

module.exports = muteCommand;
