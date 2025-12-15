const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

async function gitcloneCommand(sock, chatId, message) {
    try {
        // Add reaction to show processing
        await sock.sendMessage(chatId, {
            react: { text: '📦', key: message.key }
        });

        // Extract text from message
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || "";
        const parts = text.split(' ');
        const url = parts.slice(1).join(' ').trim();

        // Validate input
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: `📦 *GitHub Repository Cloner*\n\nPlease provide a GitHub link to clone.\n\n*Example:*\n\`\`\`.gitclone https://github.com/Dark-Xploit/CypherX\`\`\`\n\n*Usage:*\n\`\`\`.gitclone <github-url>\`\`\``
            }, { quoted: message });
        }

        // Validate URL format
        const regex1 = /(?:https|git)(?::\/\/|@)(www\.)?github\.com[\/:]([^\/:]+)\/(.+)/i;
        const match = url.match(regex1);
        
        if (!match) {
            return await sock.sendMessage(chatId, { 
                text: "❌ *Invalid GitHub URL format!*\n\nPlease provide a valid GitHub repository URL.\n\nExample: `https://github.com/username/repository`"
            }, { quoted: message });
        }

        const [, , user, repo] = match;
        const repoName = repo.replace(/\.git$/, "");

        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // GitHub API URL for zip download
        const apiUrl = `https://api.github.com/repos/${user}/${repoName}/zipball`;

        // Get repository information first
        await sock.sendMessage(chatId, {
            text: `⏳ *Downloading Repository...*\n\n👤 *Author:* ${user}\n📁 *Repository:* ${repoName}\n🔗 *URL:* ${url}\n\nPlease wait while I download the repository...`
        }, { quoted: message });

        // Get filename from headers
        const headResponse = await fetch(apiUrl, { 
            method: "HEAD",
            headers: {
                'User-Agent': 'Mozilla/5.0 (WhatsApp-Bot)'
            }
        });

        if (!headResponse.ok) {
            if (headResponse.status === 404) {
                throw new Error("Repository not found. Please check if the repository exists and is public.");
            }
            throw new Error(`GitHub API error: ${headResponse.status} ${headResponse.statusText}`);
        }

        // Check file size before downloading
        const contentLength = headResponse.headers.get('content-length');
        const fileSize = contentLength ? parseInt(contentLength) : 0;
        
        // WhatsApp file size limit (usually ~100MB for documents)
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
        
        if (fileSize > MAX_FILE_SIZE) {
            return await sock.sendMessage(chatId, {
                text: `❌ *File Too Large!*\n\nThe repository size (${formatBytes(fileSize)}) exceeds WhatsApp's limit of ${formatBytes(MAX_FILE_SIZE)}.\n\nPlease clone the repository manually or use a smaller repository.`
            }, { quoted: message });
        }

        const contentDisposition = headResponse.headers.get("content-disposition");
        let filename;
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            filename = match ? match[1] : `${repoName}.zip`;
        } else {
            filename = `${repoName}.zip`;
        }

        // Download progress message
        await sock.sendMessage(chatId, {
            text: `⬇️ *Downloading ${filename}...*\n📊 Size: ${fileSize ? formatBytes(fileSize) : 'Calculating...'}\n⏳ Estimated time: ${estimateDownloadTime(fileSize)}`
        });

        // Download the repository zip
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (WhatsApp-Bot)'
            }
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Verify download
        if (!buffer || buffer.length === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Update progress
        await sock.sendMessage(chatId, {
            text: `✅ *Download Complete!*\n📦 Preparing to send ${formatBytes(buffer.length)}...`
        });

        // Send the file as a document
        const sentMessage = await sock.sendMessage(chatId, {
            document: buffer, // Send the buffer directly
            fileName: filename,
            mimetype: "application/zip",
            caption: `📦 *GitHub Repository Cloned Successfully!*\n\n👤 *Author:* ${user}\n📁 *Repository:* ${repoName}\n📦 *File:* ${filename}\n📊 *Size:* ${formatBytes(buffer.length)}\n🔗 *URL:* ${url}\n\n✅ *Download complete!*`
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Cleanup - no file to delete since we used buffer

    } catch (error) {
        console.error("Gitclone command error:", error);

        // Remove reaction on error
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        const msg = error.message.toLowerCase();

        if (msg.includes("404") || msg.includes("not found")) {
            errorMessage = "❌ *Repository Not Found!*\n\nPlease check:\n1. The repository URL is correct\n2. The repository exists\n3. The repository is public\n4. The author's username is correct";
        } else if (msg.includes("rate limit") || msg.includes("403")) {
            errorMessage = "⚠️ *GitHub API Rate Limit Exceeded!*\n\nPlease try again in a few minutes or:\n1. Use a GitHub Personal Token\n2. Wait for rate limit reset";
        } else if (msg.includes("timeout") || msg.includes("econn")) {
            errorMessage = "🌐 *Network Error!*\n\nPlease check:\n1. Your internet connection\n2. GitHub is accessible\n3. Try again later";
        } else if (msg.includes("download") || msg.includes("failed")) {
            errorMessage = "❌ *Download Failed!*\n\nPossible issues:\n1. Repository is too large\n2. Network connectivity issues\n3. Repository may be private\n4. GitHub API issues";
        } else if (msg.includes("size") || msg.includes("large")) {
            errorMessage = "📦 *File Too Large!*\n\nThe repository exceeds WhatsApp's file size limit.\n\nTry:\n1. Cloning manually with git\n2. Downloading as ZIP from GitHub\n3. Using a smaller repository";
        } else {
            errorMessage = `❌ *Error Cloning Repository!*\n\n${error.message}\n\nPlease try again or check the repository URL.`;
        }

        return await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to estimate download time
function estimateDownloadTime(bytes) {
    if (!bytes || bytes === 0) return 'a few seconds';
    
    // Assume average download speed of 1MB/s
    const speed = 1024 * 1024; // 1MB per second
    const seconds = Math.ceil(bytes / speed);
    
    if (seconds < 60) {
        return `${seconds} seconds`;
    } else if (seconds < 3600) {
        const minutes = Math.ceil(seconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
        const hours = (seconds / 3600).toFixed(1);
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
}

module.exports = gitcloneCommand;
