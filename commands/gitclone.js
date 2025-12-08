async function gitcloneCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });
        
        const axios = require('axios');
        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = body.trim().split(' ').slice(1);
        
        if (!args[0]) {
            await sock.sendMessage(chatId, {
                text: "❌ Provide a GitHub repo link."
            });
            return;
        }
        
        if (!args[0].includes('github.com')) {
            await sock.sendMessage(chatId, {
                text: "❌ Not a valid GitHub link!"
            });
            return;
        }
        
        const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
        const match = args[0].match(regex);
        
        if (!match) {
            await sock.sendMessage(chatId, {
                text: "⚠️ Invalid repository format."
            });
            return;
        }
        
        const [user, repo] = match;
        const cleanRepo = repo.replace(/\.git$/, '');
        const zipUrl = `https://api.github.com/repos/${user}/${cleanRepo}/zipball`;
        
        const headResponse = await axios.head(zipUrl, {
            headers: { 'User-Agent': 'June-x' }
        });
        
        if (headResponse.status !== 200) {
            await sock.sendMessage(chatId, {
                text: "❌ Repository not found or access denied."
            });
            return;
        }
        
        const contentDisp = headResponse.headers['content-disposition'];
        let filename = `${cleanRepo}.zip`;
        
        if (contentDisp) {
            const filenameMatch = contentDisp.match(/attachment; filename="?(.+?)"?$/i);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }
        
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });
        
        await sock.sendMessage(
            chatId,
            {
                document: { url: zipUrl },
                fileName: filename,
                mimetype: 'application/zip'
            },
            { quoted: message }
        );
        
        await sock.sendMessage(chatId, {
            text: `✅ Successfully fetched repository: *${user}/${cleanRepo}*\n📦 Filename: ${filename}`
        }, { quoted: message });
        
    } catch (err) {
        console.error(err);
        
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
        
        let errorMessage = "❌ Failed to clone repository.\n";
        
        if (err.response) {
            switch (err.response.status) {
                case 404:
                    errorMessage += "Repository not found.";
                    break;
                case 403:
                    errorMessage += "Rate limited or access denied.";
                    break;
                default:
                    errorMessage += `GitHub API Error: ${err.response.status}`;
            }
        } else if (err.code === 'ENOTFOUND') {
            errorMessage += "Network error: Cannot connect to GitHub.";
        } else {
            errorMessage += `Error: ${err.message}`;
        }
        
        await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
