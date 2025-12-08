const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function githubCommand(sock, chatId, message) {
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text;
    const parts = text.split(' ');
    const query = parts.slice(1).join(' ').trim();

    if (!query || !query.includes('github.com')) {
        await sock.sendMessage(chatId, { text: "❌ Please provide a valid GitHub repository URL." }, { quoted: message });
        return;
    }

    try {
        await sock.sendMessage(chatId, { react: { text: "🛰️", key: message.key } });

        let regex1 = /github\.com[\/:]([^\/:]+)\/([^\/:]+)/i;
        let match = query.match(regex1);
        if (!match) {
            await sock.sendMessage(chatId, { text: "❌ Invalid GitHub repository URL format." }, { quoted: message });
            return;
        }

        let [, user3, repo] = match;
        repo = repo.replace(/.git$/, '');
        let url = `https://api.github.com/repos/${user3}/${repo}/zipball`;

        // Download the zip file as a stream
        let response = await fetch(url);
        if (!response.ok) throw new Error("Repo not found or inaccessible");

        // Save to a temporary file
        const tempPath = path.join(__dirname, `${repo}.zip`);
        const fileStream = fs.createWriteStream(tempPath);
        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream);
            response.body.on("error", reject);
            fileStream.on("finish", resolve);
        });

        const caption = `📂 *Repository:* ${user3}/${repo}\n🔗 *Download Link:* ${url}`;

        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

        // Send the file from disk
        await sock.sendMessage(chatId, {
            document: { url: tempPath },
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

        // Clean up temp file
        fs.unlink(tempPath, () => {});
    } catch (e) {
        console.error('GitHub download error:', e);
        await sock.sendMessage(chatId, { text: "❌ Error occurred while processing the GitHub repository" }, { quoted: message });
    }
}

module.exports = githubCommand;
