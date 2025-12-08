const fetch = require('node-fetch');

async function githubCommand(sock, chatId, message) {
    
    // Get text query from message type    
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const query = parts.slice(1).join(' ').trim();

    // Check if user provided a GitHub repository link
    if (!query) {
        await sock.sendMessage(chatId, {
            text: "*🔗 Please provide a GitHub repository link.*\n\n_Usage:_\n.gh https://github.com/username/repository"
        }, { quoted: message });
        return;
    }

    // Check if it's a GitHub link
    if (!query.includes('github.com')) {
        await sock.sendMessage(chatId, {
            text: "*❌ Invalid GitHub URL*\n\nPlease provide a valid GitHub repository URL."
        }, { quoted: message });
        return;
    }

    try {
        // React loading
        await sock.sendMessage(chatId, { react: { text: "🛰️", key: message.key } });

        // Extract repository information
        let regex1 = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
        let match = query.match(regex1);
        
        if (!match || match.length < 3) {
            await sock.sendMessage(chatId, {
                text: "*❌ Invalid GitHub repository URL format.*"
            }, { quoted: message });
            return;
        }

        let [, user3, repo] = match;
        repo = repo.replace(/.git$/, '');
        
        // Construct API URL
        let url = `https://api.github.com/repos/${user3}/${repo}/zipball`;
        
        // Get filename from headers
        let response = await fetch(url, { method: 'HEAD' });
        
        if (!response.ok) {
            await sock.sendMessage(chatId, {
                text: "*❌ Repository not found or inaccessible.*"
            }, { quoted: message });
            return;
        }

        let contentDisposition = response.headers.get('content-disposition');
        
        if (!contentDisposition) {
            await sock.sendMessage(chatId, {
                text: "*❌ Could not retrieve file information.*"
            }, { quoted: message });
            return;
        }

        let filenameMatch = contentDisposition.match(/attachment; filename=(.*)/);
        
        if (!filenameMatch || !filenameMatch[1]) {
            await sock.sendMessage(chatId, {
                text: "*❌ Could not extract filename.*"
            }, { quoted: message });
            return;
        }

        let filename = filenameMatch[1];
        
        // Construct caption
        const caption = `
📂 *Repository:* ${user3}/${repo}
🔗 *Download Link:* ${url}
`.trim();

        // React upload
        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

        await sock.sendMessage(chatId, {
            document: { url: url },
            fileName: filename + '.zip',
            mimetype: 'application/zip',
            caption,
            contextInfo: {
                externalAdReply: {
                    title: `${user3}/${repo}`,
                    body: "GitHub Repository",
                    mediaType: 1,
                    sourceUrl: `https://github.com/${user3}/${repo}`,
                    thumbnailUrl: `https://github.com/${user3}.png`,
                    renderLargerThumbnail: true,
                    showAdAttribution: false
                }
            }, quoted: message 
        });

        // Final reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (e) {
        console.error('GitHub download error:', e);
        
        await sock.sendMessage(chatId, {
            text: "*❌ Error occurred while processing the GitHub repository*"
        }, { quoted: message });
    }
}

module.exports = githubCommand;
