const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

async function gitcloneCommand(sock, chatId, message) {
    try {
        // Add reaction
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
                text: `📦 GitHub link to clone?\nExample:\n.gitclone https://github.com/Dark-Xploit/CypherX`
            }, { quoted: message });
        }

        // Validate URL format
        const regex1 = /(?:https|git)(?::\/\/|@)(www\.)?github\.com[\/:]([^\/:]+)\/(.+)/i;
        const match = url.match(regex1);
        
        if (!match) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Invalid GitHub link format. Please provide a valid GitHub repository URL."
            }, { quoted: message });
        }

        const [, , user, repo] = match;
        const repoName = repo.replace(/\.git$/, "");

        // Create temp directory
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // GitHub API URL for zip download
        const apiUrl = `https://api.github.com/repos/${user}/${repoName}/zipball`;

        // Get filename from headers
        const headResponse = await fetch(apiUrl, { method: "HEAD" });
        if (!headResponse.ok) {
            throw new Error(`Repository not found or inaccessible: ${headResponse.status}`);
        }

        const contentDisposition = headResponse.headers.get("content-disposition");
        let filename;
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            filename = match ? match[1] : `${repoName}.zip`;
        } else {
            filename = `${repoName}.zip`;
        }

        // Download the repository zip
        const timestamp = Date.now();
        const tempFilename = `repo_${timestamp}.zip`;
        const filePath = path.join(tempDir, tempFilename);

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

        // Verify file exists and has content
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // ✅ Send the file using { url: filePath }
        await sock.sendMessage(chatId, {
            document: { url: filePath },
            fileName: filename,
            mimetype: "application/zip",
            caption: `📦 Repository cloned successfully!\n👤 Author: ${user}\n📁 Repository: ${repoName}`
        }, { quoted: message });

        // Cleanup
        fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Gitclone command error:", error);

        let errorMessage = `❌ Error cloning repository: ${error.message}`;
        const msg = error.message.toLowerCase();

        if (msg.includes("404") || msg.includes("not found")) {
            errorMessage = "❌ Repository not found. Please check the URL and try again.";
        } else if (msg.includes("rate limit")) {
            errorMessage = "⚠️ GitHub API rate limit exceeded. Please try again later.";
        } else if (msg.includes("timeout")) {
            errorMessage = "⏱️ Request timeout. Please try again.";
        } else if (msg.includes("download")) {
            errorMessage = "❌ Failed to download repository. Check your internet connection.";
        }

        return await sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
