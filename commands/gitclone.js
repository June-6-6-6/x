const fetch = require("node-fetch");

async function gitcloneCommand(sock, chatId, message) {
    try {
        // React to show processing
        await sock.sendMessage(chatId, { react: { text: '📦', key: message.key } });

        // Extract URL
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const url = text.split(" ")[1];

        if (!url) {
            return sock.sendMessage(chatId, {
                text: "📦 *Usage:* .gitclone <github-url>\n\nExample:\n.gitclone https://github.com/username/repo"
            }, { quoted: message });
        }

        // Validate GitHub URL
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)(\.git)?/i);
        if (!match) {
            return sock.sendMessage(chatId, {
                text: "❌ Invalid GitHub URL!\n\nExample: https://github.com/username/repo"
            }, { quoted: message });
        }

        const user = match[1];
        const repo = match[2].replace(/\.git$/, "");
        const apiUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;

        await sock.sendMessage(chatId, {
            text: `⏳ Downloading *${repo}* by *${user}*...`
        }, { quoted: message });

        // Fetch ZIP
        const response = await fetch(apiUrl, { headers: { 'User-Agent': 'WhatsApp-Bot' } });
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);

        const buffer = Buffer.from(await response.arrayBuffer());

        // Send file
        await sock.sendMessage(chatId, {
            document: buffer,
            fileName: `${repo}.zip`,
            mimetype: "application/zip",
            caption: `✅ *Repository cloned successfully!*\n👤 Author: ${user}\n📁 Repo: ${repo}\n🔗 ${url}`
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error("gitclone error:", err);
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
        await sock.sendMessage(chatId, {
            text: `❌ Error: ${err.message}`
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
