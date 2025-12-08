const fetch = require('node-fetch');
async function gitcloneCommand(sock, chatId, message) {
    // Extract text from message
    const text = message.message?.conversation ||
                 message.message?.extendedTextMessage?.text ||
                 message.text ||
                 message.body || '';
    
    // Extract command and arguments
    const commandText = text.trim();
    const args = commandText.split(/\s+/);
    const command = args.shift(); // First word is the command (e.g., .gitclone)
    
    if (!args[0]) {
        return sock.sendMessage(chatId, {
            text: "❌ *GitHub link missing!*\n\n" +
                  "Usage example:\n" +
                  "`.gitclone https://github.com/username/repository`\n"
        }, { quoted: message });
    }
    
    const url = args[0];
    
    if (!/^(https?:\/\/)?github\.com\/.+/.test(url)) {
        return sock.sendMessage(chatId, {
            text: "⚠️ *Invalid GitHub URL!*\nPlease provide a valid GitHub repository link."
        }, { quoted: message });
    }
    
    try {
        // React with download emoji
        await sock.sendMessage(chatId, { react: { text: "📦", key: message.key } });
        
        // Extract username and repo from URL
        const regex = /github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/i;
        const match = url.match(regex);
        
        if (!match) throw new Error("Invalid GitHub URL format.");
        
        const [, username, repo] = match;
        const zipUrl = `https://api.github.com/repos/${username}/${repo}/zipball`;
        
        // Check if repo exists by HEAD request
        const headResp = await fetch(zipUrl, { method: "HEAD" });
        if (!headResp.ok) throw new Error("Repository not found or inaccessible.");
        
        // Extract filename from headers or fallback
        const contentDisp = headResp.headers.get("content-disposition") || "";
        const fileNameMatch = contentDisp.match(/filename="?(.+)"?/);
        const fileName = fileNameMatch ? fileNameMatch[1] : `${repo}.zip`;
        
        // Send info message before downloading
        await sock.sendMessage(chatId, {
            text: `📥 *Downloading repository...*\n\n` +
                  `╭─❍ *GIT DOWNLOAD* ❍─╮\n` +
                  `┃\n` +
                  `┃ *Repository:* ${username}/${repo}\n` +
                  `┃ *Filename:* ${fileName}\n` +
                  `┃\n` +
                  `╰─⟤\n\n` +
                  `*Downloading via WhatsApp bot* 📦\n`
        }, { quoted: message });
        
        // React with upload emoji
        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });
        
        // Send the zip file with enhanced context info
        await sock.sendMessage(chatId, {
            document: { url: zipUrl },
            fileName,
            mimetype: 'application/zip',
            caption: `📦 *Repository Cloned*\n👤 *Author:* ${username}\n📁 *Repo:* ${repo}\n🔗 *Downloaded via WhatsApp bot*`,
            contextInfo: {
                mentionedJid: [message.sender || message.key.participant || message.key.remoteJid],
                forwardingScore: 999,
                isForwarded: true,
                externalAdReply: {
                    title: repo,
                    body: `GitHub - ${username}`,
                    mediaType: 1,
                    sourceUrl: `https://github.com/${username}/${repo}`,
                    thumbnailUrl: `https://github.com/${username}.png`,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });
        
        // React with success emoji
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });
        
    } catch (error) {
        console.error("GitClone error:", error);
        
        // React with error emoji
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        
        // Send error message
        await sock.sendMessage(chatId, {
            text: `❌ *Download failed!*\n${error.message || "Please try again later."}`
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
