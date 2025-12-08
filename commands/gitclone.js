// Get text query from message type    
async function gitcloneCommand(sock, chatId, message) {
  
  const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
  const parts = text.split(' ');
  const command = parts[0].toLowerCase();
  const query = parts.slice(1).join(' ').trim();

  // Check if user provided a GitHub URL
  if (!query) {
    await sock.sendMessage(chatId, {
      text: "*🔗 Please provide a GitHub repository link.*\n\n_Usage:_\n.gitclone https://github.com/username/repository"
    }, { quoted: message });
    return;
  }

  try {
    // React loading
    await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

    const axios = require('axios');

    // Validate GitHub URL
    if (!query.includes('github.com')) {
      await sock.sendMessage(chatId, {
        text: "❌ *Not a valid GitHub link!*"
      }, { quoted: message });
      return;
    }

    // Extract GitHub username and repository name
    const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
    const match = query.match(regex);
    
    if (!match || !match[1] || !match[2]) {
      await sock.sendMessage(chatId, {
        text: "⚠️ *Invalid repository format.*"
      }, { quoted: message });
      return;
    }

    const user = match[1];
    let repo = match[2].replace(/.git$/, '');
    const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;

    // Perform a HEAD request to get filename info
    const head = await axios.head(zipUrl);
    const contentDisp = head.headers['content-disposition'];
    const filenameMatch = contentDisp?.match(/attachment; filename=(.*)/);
    const filename = filenameMatch ? filenameMatch[1] : `${repo}.zip`;

    // React upload
    await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

    await sock.sendMessage(chatId, {
      document: { url: zipUrl },
      fileName: filename,
      mimetype: 'application/zip',
      caption: `📦 *Repository Cloned:* ${user}/${repo}`,
      contextInfo: {
        externalAdReply: {
          title: `${user}/${repo}`,
          body: "GitHub Repository Clone",
          mediaType: 1,
          sourceUrl: `https://github.com/${user}/${repo}`,
          thumbnailUrl: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
          renderLargerThumbnail: true,
          showAdAttribution: false
        }
      }
    }, { quoted: message });

    // Final reaction
    await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

  } catch (error) {
    console.error("gitclone error:", error);
    
    let errorMessage = "❌ *Failed to clone repository.*";
    if (error.response) {
      if (error.response.status === 404) {
        errorMessage = "❌ *Repository not found.*";
      } else if (error.response.status === 403) {
        errorMessage = "❌ *Rate limited. Try again later.*";
      }
    }
    
    await sock.sendMessage(chatId, {
      text: `${errorMessage}\n\n_Error:_ ${error.message}`
    }, { quoted: message });
  }
}

module.exports = gitcloneCommand;
