const fetch = require('node-fetch');

async function simpleGitClone(sock, chatId, message) {
    const text = message.message?.conversation ||
                 message.message?.extendedTextMessage?.text ||
                 message.text ||
                 message.body || '';

    const args = text.trim().split(/\s+/);
    args.shift(); // remove command itself (.gitclone)

    if (!args[0]) {
        return sock.sendMessage(chatId, {
            text: "❌ Please provide a GitHub repository link.\nExample:\n.gitclone https://github.com/user/repo"
        }, { quoted: message });
    }

    const url = args[0];
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/i);
    if (!match) {
        return sock.sendMessage(chatId, {
            text: "⚠️ Invalid GitHub URL."
        }, { quoted: message });
    }

    const [, username, repo] = match;
    const zipUrl = `https://api.github.com/repos/${username}/${repo}/zipball`;

    try {
        await sock.sendMessage(chatId, {
            document: { url: zipUrl },
            fileName: `${repo}.zip`,
            mimetype: 'application/zip',
            caption: `📦 Repo: ${repo}\n👤 Author: ${username}`
        }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, {
            text: `❌ Failed to download: ${err.message}`
        }, { quoted: message });
    }
}

module.exports = simpleGitClone;
