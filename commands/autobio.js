// Utility: format seconds into human-readable runtime
function runtime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (secs || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(" ");
}

// Command: autobio
async function autobioCommand(sock, message) {
    const jid = message?.key?.remoteJid || "unknown";
    const uptime = runtime(process.uptime());
    const statusText = `𝙹𝚄𝙽𝙴 𝙼𝙳 𝙱𝙾𝚃 is Online ✅ Runtime ${uptime}`;

    try {
        // Update bot bio
        await sock.updateProfileStatus(statusText);

        // Log success
        console.log(`[AUTO-BIO] Status updated: "${statusText}"`);


    } catch (error) {
        // Log error with context
        console.error(`[AUTO-BIO] Failed to update bio for JID ${jid}:`, error);

        // Notify user gracefully
        await sock.sendMessage(jid, {
            text: '❌ Failed to update bio. Please try again later.'
        }, { quoted: message });
    }
}

module.exports = autobioCommand;
