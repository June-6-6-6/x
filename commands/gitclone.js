const fetch = require('node-fetch');

async function gitcloneCommand(sock, chatId, message) {
    const text = message.message?.conversation ||
                 message.message?.extendedTextMessage?.text ||
                 message.text || message.body || '';
    
    const args = text.trim().split(/\s+/);
    args.shift(); // remove command
    
    if (!args[0]) {
        return sock.sendMessage(chatId, { text: "❌ GitHub link missing!\nExample:\n.gitclone https://github.com/user/repo" }, { quoted: message });
    }

    const url = args[0];
    const regex = /github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/i;
    const match = url.match(regex);

    if (!match) {
        return sock.sendMessage(chatId, { text: "⚠️ Invalid GitHub URL!" }, { quoted: message });
    }

    const [, username, repo] = match;
    const zipUrl = `https://api.github.com/repos/${username}/${repo}/zipball`;

    try {
        await sock.sendMessage(chatId, { react: { text: "📦", key: message.key } });

        // Download the zip file as buffer
        const resp = await fetch(zipUrl);
        if (!resp.ok) throw new Error("Repository not found or inaccessible.");
        const buffer = await resp.buffer();

        // Send the zip file
        await sock.sendMessage(chatId, {
            document: buffer,
            fileName: `${repo}.zip`,
            mimetype: 'application/zip',
            caption: `📦 Repository: ${username}/${repo}`
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.error("GitClone error:", err);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        await sock.sendMessage(chatId, { text: `❌ Download failed!\n${err.message}` }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
