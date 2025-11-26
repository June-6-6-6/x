const fetch = require('node-fetch');

async function dareCommand(sock, chatId, message) {
    try {
        const shizokeys = 'shizo';
        const res = await fetch(https://shizoapi.onrender.com/api/texts/dare?apikey=${shizokeys});
        
        if (!res.ok) {
            throw await res.text();
        }
        
        const json = await res.json();
        const dareMessage = json.result;

        // Example: fetch an image from a URL
        const imgRes = await fetch('https://i.imgur.com/3ZQ3ZQ3.png'); // replace with your own image URL
        const imageBuffer = await imgRes.buffer();

        // Send the dare message with image
        await sock.sendMessage(
            chatId, 
            { 
                image: imageBuffer, 
                caption: dareMessage 
            }, 
            { quoted: message }
        );
    } catch (error) {
        console.error('Error in dare command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to get dare. Please try again later!' }, { quoted: message });
    }
}

module.exports = { dareCommand };
