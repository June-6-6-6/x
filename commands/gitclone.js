async function gitcloneCommand(sock, chatId, message) {
  try {
    const axios = require('axios');
    const args = message.body.split(' ').slice(1);
    const reply = (text) => sock.sendMessage(chatId, { text: text }, { quoted: message });

    if (!args[0]) return reply("❌ Provide a GitHub repo link.");
    if (!args[0].includes('github.com')) return reply("❌ Not a valid GitHub link!");

    // Extract GitHub username and repository name
    const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
    let [, user, repo] = args[0].match(regex) || [];
    if (!user || !repo) return reply("⚠️ Invalid repository format.");

    repo = repo.replace(/.git$/, '');
    const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;

    // Perform a HEAD request to get filename info
    const head = await axios.head(zipUrl);
    const contentDisp = head.headers['content-disposition'];
    const filenameMatch = contentDisp?.match(/attachment; filename=(.*)/);
    const filename = filenameMatch ? filenameMatch[1] : `${repo}.zip`;

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

    await reply(`✅ Successfully fetched repository: *${user}/${repo}*`);
  } catch (err) {
    console.error("gitclone error:", err);
    await sock.sendMessage(
      chatId, 
      { text: `❌ Failed to clone repository.\nError: ${err.message}` }, 
      { quoted: message }
    );
  }
}

module.exports = gitcloneCommand;
