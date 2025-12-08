const fetch = require('node-fetch');

async function githubCommand(sock, chatId, message) {
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text;
    const parts = text.split(' ');
    const query = parts.slice(1).join(' ').trim();

    if (!query) {
        await sock.sendMessage(chatId, {
            text: "*🔗 Please provide a GitHub repository link.*\n\n_Usage:_\n.gh https://github.com/username/repository"
        }, { quoted: message });
        return;
    }

    if (!query.includes('github.com')) {
        await sock.sendMessage(chatId, {
            text: "*❌ Invalid GitHub URL*\n\nPlease provide a valid GitHub repository URL."
        }, { quoted: message });
        return;
    }

    try {
        await sock.sendMessage(chatId, { react: { text: "🛰️", key: message.key } });

        let regex1 = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/([^\/]+)(?:\.git)?/i;
        let match = query.match(regex1);

        if (!match) {
            await sock.sendMessage(chatId, { text: "*❌ Invalid GitHub repository URL format.*" }, { quoted: message });
            return;
        }

        let [, user3, repo] = match;
        repo = repo.replace(/\.git$/, '');

        let url = `https://api.github.com/repos/${user3}/${repo}/zipball`;

        // Fetch the actual ZIP file (not just HEAD)
        let response = await fetch(url);
        if (!response.ok) {
            await sock.sendMessage(chatId, { text: "*❌ Repository not found or inaccessible.*" }, { quoted: message });
            return;
        }

        let buffer = await response.buffer();

        const caption = `
📂 *Repository:* ${user3}/${repo}
🔗 *Download Link:* ${url}
`.trim();

        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

        // Send buffer as document
        await sock.sendMessage(chatId, {
            document: buffer,
            fileName: `${repo}.zip`,
            mimetype: 'application/zip',
            caption,
            contextInfo: {
                externalAdReply: {
                    title: `${user3}/${repo}`,
                    body: "GitHub Repository",
                    mediaType: 1,
                    sourceUrl: `https://github.com/${user3}/${repo}`,
                    thumbnailUrl: `https://github.com/${user3}.png`,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (e) {
        console.error('GitHub download error:', e);
        await sock.sendMessage(chatId, { text: "*❌ Error occurred while processing the GitHub repository*" }, { quoted: message });
    }
}

module.exports = githubCommand;
