const fetch = require('node-fetch');

/**
 * GitHub Repository Downloader Command
 * Usage: .gh https://github.com/username/repository
 */
async function githubCommand(sock, chatId, message) {
    try {
        // Extract text from message
        const text = message?.message?.conversation ||
                     message?.message?.extendedTextMessage?.text || "";
        const parts = text.trim().split(/\s+/);
        const query = parts.slice(1).join(" ").trim();

        // Validate input
        if (!query) {
            return sock.sendMessage(chatId, {
                text: "*🔗 Please provide a GitHub repository link.*\n\n_Usage:_\n.gitclone https://github.com/user.../...y"
            }, { quoted: message });
        }

        if (!query.includes("github.com")) {
            return sock.sendMessage(chatId, {
                text: "*❌ Invalid GitHub URL*\n\nPlease provide a valid GitHub repository URL."
            }, { quoted: message });
        }

        // React: processing
        await sock.sendMessage(chatId, { react: { text: "🛰️", key: message.key } });

        // Regex to capture user/repo
        const regex = /github\.com[/:]([^\/:]+)\/([^\/]+?)(?:\.git)?$/i;
        const match = query.match(regex);

        if (!match) {
            return sock.sendMessage(chatId, {
                text: "*❌ Invalid GitHub repository URL format.*"
            }, { quoted: message });
        }

        const [, user, repoRaw] = match;
        const repo = repoRaw.replace(/\.git$/, "");
        const apiUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;

        // Fetch ZIP
        const response = await fetch(apiUrl, {
            headers: { "User-Agent": "WhatsApp-Bot" } // GitHub requires UA
        });

        if (!response.ok) {
            return sock.sendMessage(chatId, {
                text: `*❌ Repository not found or inaccessible.*\n\n_Status:_ ${response.status} ${response.statusText}`
            }, { quoted: message });
        }

        const buffer = await response.buffer();

        const caption = `📂 *Repository:* ${user}/${repo}\n🔗 *Download Link:* ${apiUrl}`;

        // React: uploading
        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

        // Send ZIP as document
        await sock.sendMessage(chatId, {
            document: buffer,
            fileName: `${repo}.zip`,
            mimetype: "application/zip",
            caption,
            contextInfo: {
                externalAdReply: {
                    title: `${user}/${repo}`,
                    body: "GitHub Repository",
                    mediaType: 1,
                    sourceUrl: `https://github.com/${user}/${repo}`,
                    thumbnailUrl: `https://github.com/${user}.png`,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });

        // React: success
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.error("GitHub download error:", err);
        await sock.sendMessage(chatId, {
            text: "*❌ Error occurred while processing the GitHub repository.*"
        }, { quoted: message });
    }
}

module.exports = githubCommand;
