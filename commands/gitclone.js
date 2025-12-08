const fetch = require('node-fetch');

async function gitcloneCommand(sock, chatId, message) {
    const text = message.message?.conversation ||
                 message.message?.extendedTextMessage?.text ||
                 message.text ||
                 message.body || '';

    if (!text.trim()) {
        return sock.sendMessage(chatId, {
            text: "*🔗 Please provide a GitHub repository link.*\n\n_Usage:_\n.gitclone https://github.com/user/repo"
        }, { quoted: message });
    }

    const regex = /github\.com[:\/]([^\/:]+)\/([^\/\s]+)(?:\.git)?/gi;
    const matches = [...text.matchAll(regex)];

    if (matches.length === 0) {
        return sock.sendMessage(chatId, {
            text: "*❌ Invalid GitHub repository link!*\n\n_Please provide a valid GitHub URL._"
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

    let successCount = 0;
    let errorCount = 0;

    for (const match of matches) {
        const [, user, repo] = match;
        const cleanRepo = repo.replace(/\.git$/, '').replace(/\/$/, '');
        const apiUrl = `https://api.github.com/repos/${user}/${cleanRepo}/zipball`;

        try {
            let filename = null;
            let attempt = 0;
            let success = false;

            while (attempt < 3 && !success) {
                try {
                    const method = attempt === 0 ? 'HEAD' : 'GET';
                    const response = await fetch(apiUrl, { method });

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const contentDisposition = response.headers.get('content-disposition');
                    if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                        if (filenameMatch) {
                            filename = filenameMatch[1].endsWith('.zip') ? filenameMatch[1] : filenameMatch[1] + '.zip';
                            success = true;
                        }
                    }

                    if (!success && method === 'GET') {
                        // Fallback filename if headers missing
                        filename = `${cleanRepo}.zip`;
                        success = true;
                    }

                } catch (err) {
                    attempt++;
                    if (attempt < 3) {
                        await sock.sendMessage(chatId, {
                            text: `*⚠️ Retry ${attempt} for ${user}/${cleanRepo}...*`
                        }, { quoted: message });
                        await new Promise(res => setTimeout(res, attempt * 1000)); // backoff
                    } else {
                        throw err;
                    }
                }
            }

            if (!success) throw new Error('Failed to retrieve repository after retries');

            await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

            await sock.sendMessage(chatId, {
                document: { url: apiUrl },
                fileName: filename,
                mimetype: 'application/zip',
                caption: `📦 *Repository Cloned*\n👤 *Author:* ${user}\n📁 *Repo:* ${cleanRepo}\n🔗 *Downloaded via June MD*`,
                contextInfo: {
                    externalAdReply: {
                        title: cleanRepo,
                        body: `GitHub - ${user}`,
                        mediaType: 1,
                        sourceUrl: `https://github.com/${user}/${cleanRepo}`,
                        thumbnailUrl: `https://github.com/${user}.png`,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: message });

            successCount++;
            if (matches.length > 1 && successCount < matches.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (err) {
            console.error('Download error:', err);
            errorCount++;
            await sock.sendMessage(chatId, {
                text: `*❌ Error Downloading*\nRepository: ${user}/${cleanRepo}\nError: ${err.message}`
            }, { quoted: message });
        }
    }

    const finalReaction = successCount > 0 ? "✅" : "❌";
    await sock.sendMessage(chatId, { react: { text: finalReaction, key: message.key } });

    if (matches.length > 1) {
        await sock.sendMessage(chatId, {
            text: `*📊 Download Summary*\n✅ Success: ${successCount}\n❌ Failed: ${errorCount}\n🔗 Total: ${matches.length}`
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
