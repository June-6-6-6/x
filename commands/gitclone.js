async function gitcloneCommand(sock, chatId, message) {
    // Get text query from message type (same as aiCommand)
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text ||
                 message.text || 
                 message.body || '';
    
    if (!text.trim()) {
        await sock.sendMessage(chatId, {
            text: "*🔗 Please provide a GitHub repository link.*\n\n_Usage:_\n.gitclone https://github.com/user/repo"
        }, { quoted: message });
        return;
    }

    // Regex to extract GitHub links
    const regex = /github\.com[:\/]([^\/:]+)\/([^\/\s]+)(?:\.git)?/gi;
    const matches = [...text.matchAll(regex)];

    if (matches.length === 0) {
        await sock.sendMessage(chatId, {
            text: "*❌ Invalid GitHub repository link!*\n\n_Please provide a valid GitHub URL._"
        }, { quoted: message });
        return;
    }

    // React loading
    await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

    // Handle multiple links in one message
    let successCount = 0;
    let errorCount = 0;

    for (const match of matches) {
        const [, user, repo] = match;
        const cleanRepo = repo.replace(/\.git$/, '').replace(/\/$/, '');
        const url = `https://api.github.com/repos/${user}/${cleanRepo}/zipball`;

        try {
            // Fetch headers to get filename
            const response = await fetch(url, { method: 'HEAD' });
            
            if (!response.ok) {
                throw new Error(`Repository not found or inaccessible: ${user}/${cleanRepo}`);
            }

            const contentDisposition = response.headers.get('content-disposition');
            
            if (!contentDisposition) {
                throw new Error('Could not get download information');
            }

            const filenameMatch = contentDisposition.match(/attachment; filename="?([^"]+)"?/);
            
            if (!filenameMatch) {
                throw new Error('Could not extract filename');
            }

            const filename = filenameMatch[1];

            // React uploading
            await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

            // Send the zip file as document
            await sock.sendMessage(chatId, {
                document: { url },
                fileName: filename.endsWith('.zip') ? filename : filename + '.zip',
                mimetype: 'application/zip',
                caption: `📦 *Repository Cloned*\n👤 *Author:* ${user}\n📁 *Repo:* ${cleanRepo}\n🔗 *Downloaded via June MD*`,
                contextInfo: {
                    externalAdReply: {
                        title: cleanRepo,
                        body: `GitHub - ${user}`,
                        mediaType: 1,
                        sourceUrl: `https://github.com/${user}/${cleanRepo}`,
                        thumbnailUrl: `https://github.com/${user}.png`,
                        renderLargerThumbnail: true,
                        showAdAttribution: false
                    }
                }
            }, { quoted: message });

            successCount++;
            
            // Small delay between multiple downloads
            if (matches.length > 1 && successCount < matches.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            console.error('Error downloading repository:', error);
            errorCount++;
            
            await sock.sendMessage(chatId, {
                text: `*❌ Error Downloading*\nRepository: ${user}/${cleanRepo}\nError: ${error.message}`
            }, { quoted: message });
        }
    }

    // Final reaction based on results
    if (successCount > 0) {
        await sock.sendMessage(chatId, { 
            react: { text: "✅", key: message.key } 
        });
        
        if (matches.length > 1) {
            await sock.sendMessage(chatId, {
                text: `*📊 Download Summary*\n✅ Success: ${successCount}\n❌ Failed: ${errorCount}\n🔗 Total: ${matches.length}`
            }, { quoted: message });
        }
    } else {
        await sock.sendMessage(chatId, { 
            react: { text: "❌", key: message.key } 
        });
    }
}

module.exports = gitcloneCommand;
