async function chaneljidCommand(sock, chatId, message) {
    const chaneljid = message.key.remoteJid;

    if (!chaneljid.endsWith('@newsletter')) {
        return await sock.sendMessage(chatId, {
            text: "❌ This command can only be used in a channel."
        });
    }

    await sock.sendMessage(chatId, {
        text: `✅ Channel JID: ${chaneljid}`
    }, {
        quoted: message
    });
}

module.exports = { channeljidCommand };
