const fetch = require('node-fetch');

async function truthCommand(sock, chatId, message) {
    try {
        const shizokeys = 'shizo';
        const res = await fetch(`https://shizokeys.onrender.com/api/texts/truth?apikey=${shizokeys}`);
        
        if (!res.ok) {
            throw new Error(`API request failed with status ${res.status}`);
        }
        
        const json = await res.json();
        
        // Check if the response has the expected structure
        if (!json || !json.result) {
            throw new Error('Invalid API response structure');
        }
        
        const truthMessage = json.result;
        
        // Truth-themed image URL
        const truthImageUrl = "https://i.imgur.com/6Q7z5J2.png"; 
        
        // Send image with caption as the truth message
        await sock.sendMessage(chatId, {
            image: { url: truthImageUrl },
            caption: `💬 *Truth Challenge:*\n\n${truthMessage}`,
            contextInfo: {
                mentionedJid: message.key.participant ? [message.key.participant] : []
            }
        }, { quoted: message });

    } catch (error) {
        console.error('Error in truth command:', error);
        
        // Fallback: Send image + text instead of text only
        const fallbackImageUrl = "https://i.imgur.com/6Q7z5J2.png"; // same or different fallback image
        const fallbackMessage = '❌ Failed to get truth. Please try again later!';
        
        try {
            await sock.sendMessage(chatId, { 
                image: { url: fallbackImageUrl },
                caption: `💬 *Truth Challenge:*\n\n${fallbackMessage}`,
                contextInfo: {
                    mentionedJid: message.key.participant ? [message.key.participant] : []
                }
            }, { quoted: message });
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            await sock.sendMessage(chatId, { 
                text: fallbackMessage 
            }, { quoted: message });
        }
    }
}

module.exports = { truthCommand };
