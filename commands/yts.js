const yts = require('yt-search');

async function ytsCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `🔍 *YouTube Search Command*\n\nUsage:\n.yts <search_query>\n\nExample:\n.yts Godzilla\n.yts latest songs\n.yts tutorial for JUNE-X`
            });
        }

        await sock.sendMessage(chatId, {
            text: `🌍 Searching YouTube Results for: "${query}"...`
        },{ quoted: message });

        let searchResults;
        try {
            searchResults = await yts(query);
        } catch (searchError) {
            console.error('YouTube search error:', searchError);
            return await sock.sendMessage(chatId, {
                text: '❌ Error searching YouTube. Please try again later.'
            });
        }

        const videos = (searchResults && searchResults.videos) ? searchResults.videos.slice(0, 10) : [];

        if (videos.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `❌ No results found for "${query}"\n\nTry different keywords.`
            });
        }

        let resultMessage = `📑 *YOUTUBE SEARCH RESULTS:* "${query}"\n\n`;

        videos.forEach((video, index) => {
            const duration = video.timestamp || 'N/A';
            const views = video.views ? video.views.toLocaleString() : 'N/A';
            const uploadDate = video.ago || 'N/A';

            resultMessage += `*${index + 1}. ${video.title}*\n`;
            resultMessage += `🌐 *URL:* ${video.url}\n`;
            resultMessage += `⏱️ *Duration:* ${duration}\n`;
            resultMessage += `🪟 *Views:* ${views}\n`;
            resultMessage += `⤴️ *Uploaded:* ${uploadDate}\n`;
            resultMessage += `🧾 *Channel:* ${video.author?.name || 'N/A'}\n\n`;
        });

        resultMessage += `🌍 *Tip:* Use play <url> to download audio\n`;
        resultMessage += `🗺️ Use video <url> to download video`;

        await sock.sendMessage(chatId, { text: resultMessage },{ quoted: message});

    } catch (error) {
        console.error('YouTube search command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred while searching YouTube. Please try again.'
        });
    }
}

module.exports = ytsCommand;
