async function gitcloneCommand(sock, chatId, message) {
  try {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    // Safely extract text from message
    const body = message.body || message.text || message.conversation || "";
    const args = body.trim().split(' ').slice(1);

    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });

    if (!args[0]) {
      await reply("❌ Provide a GitHub repo link.");
      await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
      return;
    }

    if (!args[0].includes('github.com')) {
      await reply("❌ Not a valid GitHub link!");
      await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
      return;
    }

    // Extract GitHub username and repository name
    const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
    const match = args[0].match(regex);
    
    if (!match) {
      await reply("⚠️ Invalid repository format.");
      await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key } });
      return;
    }

    const [, user, repo] = match;
    if (!user || !repo) {
      await reply("⚠️ Invalid repository format.");
      await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key } });
      return;
    }

    const cleanRepo = repo.replace(/\.git$/, '');
    const zipUrl = `https://api.github.com/repos/${user}/${cleanRepo}/zipball`;

    // Send initial processing reaction
    await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

    // Perform a HEAD request to get filename info
    const headResponse = await axios.head(zipUrl, {
      headers: {
        'User-Agent': 'WhatsApp-Bot'
      }
    });

    // Check if repository exists
    if (headResponse.status !== 200) {
      await reply("❌ Repository not found or access denied.");
      await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
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

    // Send success reaction before file
    await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    // Send ZIP file to user
    await sock.sendMessage(
      chatId,
      {
        document: { url: zipUrl },
        fileName: filename,
        mimetype: 'application/zip'
      },
      { quoted: message }
    );

    await reply(`✅ Successfully fetched repository: *${user}/${cleanRepo}*\n📦 Filename: ${filename}`);

  } catch (err) {
    console.error("gitclone error:", err);
    
    // Send error reaction
    await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    
    // Handle specific error cases
    let errorMessage = `❌ Failed to clone repository.\n`;
    
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
    
    await sock.sendMessage(
      chatId, 
      { text: errorMessage }, 
      { quoted: message }
    );
  }
}

module.exports = gitcloneCommand;
