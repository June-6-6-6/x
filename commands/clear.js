async function clearCommand(sock, chatId) {
    try {
        // Notify user that clearing has started
        const statusMsg = await sock.sendMessage(chatId, { text: 'Clearing bot messages...' });

        // Fetch recent messages from the chat
        const messages = await sock.fetchMessages(chatId, 50); 
        // Adjust the number (500) depending on how many you want to clear

        for (const msg of messages) {
            // Example: only delete messages sent by the bot itself
            if (msg.key.fromMe) {
                await sock.sendMessage(chatId, { delete: msg.key });
            }
        }

        // Delete the status message itself
        await sock.sendMessage(chatId, { delete: statusMsg.key });

    } catch (error) {
        console.error('Error clearing messages:', error);
        await sock.sendMessage(chatId, { text: 'An error occurred while clearing messages.' });
    }
}

module.exports = { clearCommand };
