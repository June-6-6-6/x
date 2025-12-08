async function gitcloneCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });
        
        const axios = require('axios');
        
        // Extract text from message - fix for different message types
        let body = "";
        if (message.message?.conversation) {
            body = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            body = message.message.extendedTextMessage.text;
        } else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation) {
            body = message.message.extendedTextMessage.contextInfo.quotedMessage.conversation;
        }
        
        // Clean and split the command
        const args = body.trim().split(/\s+/);
        
        // Check if command exists
        if (args.length < 2) {
            await sock.sendMessage(chatId, {
                text: "❌ Please provide a GitHub repository URL.\n\nUsage: *!gitclone https://github.com/username/repository*"
            });
            return;
        }
        
        const repoUrl = args[1]; // First argument after command
        
        if (!repoUrl.includes('github.com')) {
            await sock.sendMessage(chatId, {
                text: "❌ Not a valid GitHub link!\nPlease provide a valid GitHub repository URL."
            });
            return;
        }
        
        // Fix regex pattern to properly extract username and repo
        const regex = /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/\s?#]+)/i;
        const match = repoUrl.match(regex);
        
        if (!match || match.length < 3) {
            await sock.sendMessage(chatId, {
                text: "⚠️ Invalid repository format. Expected: https://github.com/username/repository"
            });
            return;
        }
        
        const user = match[1];
        let repo = match[2];
        
        // Remove .git extension if present
        repo = repo.replace(/\.git$/, '');
        
        // Construct zip URL
        const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;
        
        console.log(`Attempting to fetch: ${zipUrl}`);
        
        // First, check if repo exists using GET instead of HEAD for better compatibility
        try {
            await axios.get(`https://api.github.com/repos/${user}/${repo}`, {
                headers: {
                    'User-Agent': 'GitClone-Bot',
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
        } catch (error) {
            if (error.response?.status === 404) {
                await sock.sendMessage(chatId, {
                    text: "❌ Repository not found. Please check the URL."
                });
                return;
            }
            throw error;
        }
        
        // Get the zip file
        const response = await axios({
            method: 'GET',
            url: zipUrl,
            headers: {
                'User-Agent': 'GitClone-Bot',
                'Accept': 'application/vnd.github.v3+json'
            },
            responseType: 'stream'
        });
        
        if (response.status !== 200) {
            await sock.sendMessage(chatId, {
                text: "❌ Failed to fetch repository archive."
            });
            return;
        }
        
        // Get filename from headers or construct one
        let filename = `${repo}.zip`;
        const contentDisposition = response.headers['content-disposition'];
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename=["']?([^"']+)["']?/i);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }
        
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });
        
        // Send the file
        await sock.sendMessage(
            chatId,
            {
                document: { url: zipUrl },
                fileName: filename,
                mimetype: 'application/zip',
                caption: `📦 Repository: ${user}/${repo}\n⚡ Cloned via gitclone command`
            }
        );
        
        console.log(`Successfully sent repository: ${user}/${repo}`);
        
    } catch (err) {
        console.error("GitClone Error:", err);
        
        // Remove reaction if it exists
        try {
            await sock.sendMessage(chatId, {
                react: { text: '❌', key: message.key }
            });
        } catch (reactError) {
            console.error("Failed to send reaction:", reactError);
        }
        
        let errorMessage = "❌ Failed to clone repository.\n\n";
        
        if (err.response) {
            console.log("Response status:", err.response.status);
            console.log("Response data:", err.response.data);
            
            switch (err.response.status) {
                case 404:
                    errorMessage += "Repository not found or doesn't exist.";
                    break;
                case 403:
                    errorMessage += "Rate limited or access denied by GitHub.";
                    if (err.response.headers['x-ratelimit-remaining']) {
                        errorMessage += `\nRate limit remaining: ${err.response.headers['x-ratelimit-remaining']}`;
                    }
                    break;
                case 429:
                    errorMessage += "Too many requests. Please try again later.";
                    break;
                default:
                    errorMessage += `GitHub API Error: ${err.response.status}`;
                    if (err.response.data?.message) {
                        errorMessage += `\nMessage: ${err.response.data.message}`;
                    }
            }
        } else if (err.code === 'ENOTFOUND') {
            errorMessage += "Network error: Cannot connect to GitHub API.";
        } else if (err.message) {
            errorMessage += `Error: ${err.message}`;
        } else {
            errorMessage += "An unexpected error occurred.";
        }
        
        await sock.sendMessage(chatId, {
            text: errorMessage
        });
    }
}

module.exports = gitcloneCommand;
