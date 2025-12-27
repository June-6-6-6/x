// Channel JID Extractor
async function channeljidCommand(sock, chatId, message, args = []) {
    try {
        let targetJid = null;

        // 1️⃣ If a link or JID is provided
        if (args.length > 0) {
            const input = args[0].trim();

            if (input.endsWith('@newsletter')) {
                targetJid = input;
            } else if (input.includes('whatsapp.com/channel/')) {
                const code = input.split('/').pop().trim();
                targetJid = `120363${code}@newsletter`;
            } else {
                return await sock.sendMessage(chatId, { text: '❌ Invalid channel link or JID' }, { quoted: message });
            }
        } else {
            // 2️⃣ If no argument, use current chat JID
            targetJid = message.key.remoteJid;
        }

        // 3️⃣ Final validation
        if (!targetJid.endsWith('@newsletter')) {
            return await sock.sendMessage(chatId, {
                text: '❌ This is not a WhatsApp channel/newsletter\n\n📌 Tip:\n.channeljid <channel link or JID>'
            }, { quoted: message });
        }

        // 4️⃣ Output ONLY the JID
        await sock.sendMessage(chatId, { text: targetJid }, { quoted: message });

    } catch (err) {
        console.error('❌ ChannelJID Error:', err);
        await sock.sendMessage(chatId, { text: '⚠️ Failed to fetch channel JID' }, { quoted: message });
    }
}

module.exports = { channeljidCommand };
