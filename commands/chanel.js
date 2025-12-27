// Channel JID Extractor
async function chaneljidCommand(sock, chatId, message) {
    try {
        // Extract text from message
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

        // Split text into command + args
        const args = text.trim().split('').slice(1); 
        // Example: ".channeljid https://whatsapp.com/channel/ABC123"
        // args[0] = "https://whatsapp.com/channel/ABC123"

        let targetJid = null;

        // 1️⃣ If a link or JID is provided
        if (args[0]) {
            const input = args[0];

            // Newsletter JID directly
            if (input.endsWith('@newsletter')) {
                targetJid = input;
            }
            // WhatsApp channel/newsletter link
            else if (input.includes('whatsapp.com/channel/')) {
                const code = input.split('/').pop().trim();
                targetJid = `120363${code}@newsletter`;  // ✅ use template literal
            }
            else {
                return await sock.sendMessage(
                    chatId,
                    { text: '❌ Invalid channel link or JID' },
                    { quoted: message }
                );
            }
        }
        

        // 3️⃣ Final validation
        if (!targetJid.endsWith('@newsletter')) {
            return await sock.sendMessage(
                chatId,
                {
                    text: '❌ This is not a WhatsApp channel/newsletter\n\n' +
                          '📌 Tip:\n' +
                          '.channeljid <channel link or JID>'
                },
                { quoted: message }
            );
        }

        // 4️⃣ Output ONLY the JID (clean & obvious)
        await sock.sendMessage(
            chatId,
            { text: `${targetJid}` },   // ✅ fixed template literal
            { quoted: message }
        );

    } catch (err) {
        console.error('❌ ChannelJID Error:', err);

        await sock.sendMessage(
            chatId,
            { text: '⚠️ Failed to fetch channel JID' },
            { quoted: message }
        );
    }
}

module.exports = { chaneljidCommand };
