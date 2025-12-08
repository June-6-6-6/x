const fetch = require('node-fetch');

async function githubCommand(sock, chatId, message) {
    try {
        // Add loading reaction
        await sock.sendMessage(chatId, {
            react: { text: '🛰️', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text;

        // Validate input
        if (!text) {
            await sock.sendMessage(chatId, { 
                text: "Please provide a GitHub repository link\n\nExample: https://github.com/username/repository"
            });
            return;
        }

        // Check if it's a GitHub link
        if (!text.includes('github.com')) {
            await sock.sendMessage(chatId, { 
                text: "Is that a GitHub repo link?! Please provide a valid GitHub repository URL."
            }, { quoted: message });
            return;
        }

        // Extract repository information
        let regex1 = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
        let match = text.match(regex1);
        
        if (!match || match.length < 3) {
            await sock.sendMessage(chatId, { 
                text: "Invalid GitHub repository URL format."
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
                text: "Error: Repository not found or inaccessible."
            }, { quoted: message });
            return;
        }

        let contentDisposition = response.headers.get('content-disposition');
        
        if (!contentDisposition) {
            await sock.sendMessage(chatId, { 
                text: "Error: Could not retrieve file information."
            }, { quoted: message });
            return;
        }

        let filenameMatch = contentDisposition.match(/attachment; filename=(.*)/);
        
        if (!filenameMatch || !filenameMatch[1]) {
            await sock.sendMessage(chatId, { 
                text: "Error: Could not extract filename."
            }, { quoted: message });
            return;
        }

        let filename = filenameMatch[1];
        
        // Send the zip file
        await sock.sendMessage(chatId, { 
            document: { url: url }, 
            fileName: filename + '.zip', 
            mimetype: 'application/zip'
        }, { quoted: message });

        // Add success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (err) {
        console.error('GitHub download error:', err);
        
        await sock.sendMessage(chatId, { 
            text: "❎ Error occurred while processing the GitHub repository"
        }, { quoted: message });
    }
}

module.exports = githubCommand;
