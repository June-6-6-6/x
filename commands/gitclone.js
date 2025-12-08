const fetch = require('node-fetch');

async function gitcloneCommand(sock, chatId, message) {
    
    // Get text query from message type    
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const query = parts.slice(1).join(' ').trim();

    // Check if user provided a GitHub repository link
    if (!query) {
        await sock.sendMessage(chatId, {
            text: "*🔗 Please provide a GitHub repository link to clone.*\n\n_Usage:_\n.gitclone https://github.com/username/repository"
        }, { quoted: message });
        return;
    }

    // Check if it's a GitHub link
    if (!query.includes('github.com')) {
        await sock.sendMessage(chatId, {
            text: "*❌ Not a valid GitHub link!*\n\nPlease provide a valid GitHub repository URL."
        }, { quoted: message });
        return;
    }

    try {
        // React loading
        await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

        // Extract GitHub username and repository name
        const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
        let [, user, repo] = query.match(regex) || [];
        
        if (!user || !repo) {
            await sock.sendMessage(chatId, {
                text: "*⚠️ Invalid repository format.*"
            }, { quoted: message });
            return;
        }

        repo = repo.replace(/.git$/, '');
        const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;

        // Perform a HEAD request to get filename info
        const response = await fetch(zipUrl, { method: 'HEAD' });
        
        if (!response.ok) {
            await sock.sendMessage(chatId, {
                text: "*❌ Repository not found or inaccessible.*"
            }, { quoted: message });
            return;
        }

        const contentDisp = response.headers.get('content-disposition');
        const filenameMatch = contentDisp?.match(/attachment; filename=(.*)/);
        const filename = filenameMatch ? filenameMatch[1] : `${repo}.zip`;

        // Construct caption
        const caption = `
📂 *Repository:* ${user}/${repo}
⚡ *Cloned Successfully*
🔗 *Source:* ${query}
`.trim();

        // React upload
        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

        await sock.sendMessage(chatId, {
            document: { url: zipUrl },
            fileName: filename,
            mimetype: 'application/zip',
            caption,
            contextInfo: {
                externalAdReply: {
                    title: `${user}/${repo}`,
                    body: "GitHub Clone",
                    mediaType: 1,
                    sourceUrl: `https://github.com/${user}/${repo}`,
                    thumbnailUrl: `https://github.com/${user}.png`,
                    renderLargerThumbnail: true,
                    showAdAttribution: false
                }
            }, quoted: message 
        });

        // Final reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (e) {
        console.error('Git clone error:', e);
        
        await sock.sendMessage(chatId, {
            text: `*❌ Failed to clone repository.*\nError: ${e.message}`
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
