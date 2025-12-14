const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

async function gitcloneCommand(sock, chatId, message) {
    try {
        const pushname = message.pushName || "User";
        
        // Check if user wants to download or just get commands
        const args = message.text.split(' ');
        if (args.length < 2) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Usage:* .gitclone <github-repo-url> [--zip]\n*Example:* .gitclone https://github.com/user/repo\n*Example with download:* .gitclone https://github.com/user/repo --zip' 
            });
            return;
        }

        const repoUrl = args[1].trim();
        const downloadZip = args.includes('--zip');
        
        // Extract username and repo name from URL
        const urlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!urlMatch) {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid GitHub URL format. Please provide a valid URL like: https://github.com/user/repo' 
            });
            return;
        }

        const username = urlMatch[1];
        const repoName = urlMatch[2].replace('.git', '');
        
        // Generate git clone commands
        const gitCloneCmd = `git clone ${repoUrl}`;
        const sshCloneCmd = `git clone git@github.com:${username}/${repoName}.git`;
        
        if (downloadZip) {
            // Send downloading message
            await sock.sendMessage(chatId, { 
                text: `⏳ *Downloading repository...*\nRepository: ${username}/${repoName}\nPlease wait...` 
            });

            // Fetch repository info to get default branch
            const apiUrl = `https://api.github.com/repos/${username}/${repoName}`;
            const res = await fetch(apiUrl);
            
            if (!res.ok) {
                throw new Error(`Repository not found or access denied (Status: ${res.status})`);
            }
            
            const repoInfo = await res.json();
            const defaultBranch = repoInfo.default_branch || 'main';
            
            // Download ZIP URL
            const zipUrl = `https://github.com/${username}/${repoName}/archive/refs/heads/${defaultBranch}.zip`;
            const tempFilePath = `./temp_${username}_${repoName}.zip`;
            
            try {
                // Download the ZIP file
                const response = await fetch(zipUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to download ZIP file (Status: ${response.status})`);
                }
                
                // Save to temporary file
                const fileStream = fs.createWriteStream(tempFilePath);
                await pipeline(response.body, fileStream);
                
                // Read file as buffer
                const fileBuffer = fs.readFileSync(tempFilePath);
                const fileSize = fileBuffer.length;
                
                // Check file size (WhatsApp has limits, usually 16MB for documents)
                const maxSize = 15 * 1024 * 1024; // 15MB for safety
                
                if (fileSize > maxSize) {
                    fs.unlinkSync(tempFilePath); // Clean up
                    await sock.sendMessage(chatId, { 
                        text: `📦 *Repository too large*\n\nRepository: ${username}/${repoName}\nFile size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB\n\nMax allowed size: 15MB\n\nHere are the clone commands instead:\n\n\`\`\`${gitCloneCmd}\`\`\`\n\`\`\`${sshCloneCmd}\`\`\`` 
                    });
                    return;
                }
                
                // Send the ZIP file
                await sock.sendMessage(chatId, {
                    document: fileBuffer,
                    fileName: `${username}_${repoName}.zip`,
                    mimetype: 'application/zip',
                    caption: `📦 *Repository Downloaded*\n\n🔹 Repository: ${username}/${repoName}\n🔹 Branch: ${defaultBranch}\n🔹 Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB\n🔹 Downloaded for: ${pushname}\n\n*Clone commands:*\nHTTPS: \`${gitCloneCmd}\`\nSSH: \`${sshCloneCmd}\``
                });
                
                // Clean up temporary file
                fs.unlinkSync(tempFilePath);
                
                // Success reaction
                await sock.sendMessage(chatId, {
                    react: { text: '✅', key: message.key }
                });
                
            } catch (downloadError) {
                // Clean up temp file if exists
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                throw downloadError;
            }
            
        } else {
            // Just send the clone commands
            let txt = `📂 *Git Clone Commands*\n\n`;
            txt += `🔹 *Repository:* ${username}/${repoName}\n\n`;
            txt += `🔸 *Clone with HTTPS:*\n\`\`\`${gitCloneCmd}\`\`\`\n`;
            txt += `🔸 *Clone with SSH:*\n\`\`\`${sshCloneCmd}\`\`\`\n\n`;
            txt += `📦 *Want the ZIP file?*\nUse: \`.gitclone ${repoUrl} --zip\`\n\n`;
            txt += `*Hey ${pushname}, use the commands above to clone this repository!*`;

            await sock.sendMessage(chatId, { text: txt });

            // Success reaction
            await sock.sendMessage(chatId, {
                react: { text: '📂', key: message.key }
            });
        }

    } catch (error) {
        console.error('Git Clone Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}\n\nPlease ensure:\n1. Repository exists and is public\n2. URL is correct\n3. Try again later if rate limited` 
        });
    }
}

module.exports = gitcloneCommand;
