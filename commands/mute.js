const isAdmin = require('../lib/isAdmin');

async function muteCommand(sock, chatId, senderId, message, durationInMinutes) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: '⚠️ Please make the bot an admin first.' }, { quoted: message });
        return;
    }

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: '🚫 Only group admins can use the mute command.' }, { quoted: message });
        return;
    }

    try {
        // Get group metadata (to include group name)
        const metadata = await sock.groupMetadata(chatId);
        const groupName = metadata.subject || 'this group';

        // Mute the group (announcement mode)
        await sock.groupSettingUpdate(chatId, { announce: true });

        if (durationInMinutes && durationInMinutes > 0) {
            const durationInMilliseconds = durationInMinutes * 60 * 1000;

            await sock.sendMessage(
                chatId,
                { text: `🔇 ${groupName} has been muted for ${durationInMinutes} minutes.` },
                { quoted: message }
            );

            // Schedule unmute
            setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(chatId, { announce: false });
                    await sock.sendMessage(chatId, { text: `🔊 ${groupName} has been unmuted.` },{ quoted: message });
                } catch (unmuteError) {
                    console.error('Error unmuting group:', unmuteError);
                }
            }, durationInMilliseconds);
        } else {
            await sock.sendMessage(
                chatId,
                { text: `🔇 ${groupName} has been muted indefinitely.` },
                { quoted: message }
            );
        }
    } catch (error) {
        console.error('Error muting/unmuting the group:', error);
        await sock.sendMessage(
            chatId,
            { text: '❌ An error occurred while muting/unmuting the group. Please try again.' },
            { quoted: message }
        );
    }
}

module.exports = muteCommand;
