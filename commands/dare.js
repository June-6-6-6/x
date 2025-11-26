const fetch = require('node-fetch');

async function dareCommand(sock, chatId, message) {
    try {
        const shizokeys = 'shizo';
        const res = await fetch(`https://shizoapi.onrender.com/api/texts/dare?apikey=${shizokeys}`);
        
        if (!res.ok) {
            throw await res.text();
        }
        
        const json = await res.json();
        const dareMessage = json.result;

        // Dare-themed images (you can expand this list)
        const dareImages = [
            "https://i.imgur.com/3ZQ3ZQ3.png", // example dare icon
            "https://i.imgur.com/6Q7z5J2.png", // truth/dare style icon
            "https://i.imgur.com/abc1234.png"  // replace with your own
        ];

        // Pick a random dare image
        const dareImageUrl = dareImages[Math.floor(Math.random() * dareImages.length)];

        // Fetch the image
        const imgRes = await fetch(dareImageUrl);
        const imageBuffer = await imgRes.buffer();

        // Send the dare message with image
        await sock.sendMessage(
            chatId, 
            { 
                image: imageBuffer, 
                caption: `🔥 *Dare Challenge:*\n\n${dareMessage}`
            }, 
            { quoted: message }
        );
    } catch (error) {
        console.error('Error in dare command:', error);

        // Fallback: send text + default dare image
        const fallbackImageUrl = "https://i.imgur.com/6Q7z5J2.png";
        try {
            const imgRes = await fetch(fallbackImageUrl);
            const imageBuffer = await imgRes.buffer();

            await sock.sendMessage(
                chatId, 
                { 
                    image: imageBuffer, 
                    caption: '❌ Failed to get dare. Please try again later!' 
                }, 
                { quoted: message }
            );
        } catch (fallbackError) {
            await sock.sendMessage(chatId, { text: '❌ Failed to get dare. Please try again later!' }, { quoted: message });
        }
    }
}

module.exports = { dareCommand };
