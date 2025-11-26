async function pairCommand(sock, chatId, message) {
    // ✅ Fix for node-fetch v3.x (ESM-only module)
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        // Extract text from different message types
        const q = message?.conversation ||
                 message?.extendedTextMessage?.text ||
                 message?.imageMessage?.caption ||
                 message?.videoMessage?.caption || '';

        console.log("📥 Raw message text:", q);

        const number = q.replace(/^[.\/!]pair\s*/i, '').trim();

        if (!number) {
            return await sock.sendMessage(chatId, {
                text: '*📌 Usage:* .pair +9476066XXXX\n*Example:* .pair +94761234567'
            }, { quoted: message });
        }

        // Validate phone number format
        if (!/^\+?\d{10,15}$/.test(number.replace(/\s/g, ''))) {
            return await sock.sendMessage(chatId, {
                text: '❌ Invalid phone number format.\n*Please use:* +9476066XXXX'
            }, { quoted: message });
        }

        console.log("🔍 Processing number:", number);

        const url = `https://a-sula-mini-6ae993c26705.herokuapp.com/code?number=${encodeURIComponent(number)}`;
        console.log("🌐 API URL:", url);

        const response = await fetch(url);
        const statusCode = response.status;
        const bodyText = await response.text();

        console.log("📊 API Status:", statusCode);
        console.log("🌐 API Response:", bodyText);

        if (statusCode !== 200) {
            return await sock.sendMessage(chatId, {
                text: `❌ API Error: Server returned status ${statusCode}\n\nPlease try again later.`
            }, { quoted: message });
        }

        let result;
        try {
            result = JSON.parse(bodyText);
        } catch (e) {
            console.error("❌ JSON Parse Error:", e);
            return await sock.sendMessage(chatId, {
                text: '❌ Invalid response from server.\n\n*Response received:* ' + bodyText.substring(0, 100) + '...'
            }, { quoted: message });
        }

        if (!result || !result.code) {
            console.error("❌ No code in response:", result);
            return await sock.sendMessage(chatId, {
                text: '❌ Failed to retrieve pairing code.\n\n*Possible reasons:*\n• Invalid number format\n• Server issue\n• Number not supported\n\nPlease check the number and try again.'
            }, { quoted: message });
        }

        console.log("✅ Pairing code retrieved:", result.code);

        // Send success message
        await sock.sendMessage(chatId, {
            text: `> *𝐑𝙾𝙾𝚃_𝐗 𝐌𝙳 𝐌𝙸𝙽𝙸 𝐁𝙾𝚃 𝐏𝙰𝙸𝚁 𝐂𝙾𝙼𝙿𝙻𝙴𝚃𝙴𝙳* ✅\n\n*📱 Number:* ${number}\n*🔑 Your pairing code is:* ${result.code}\n\n_Use this code to pair your device._`
        }, { quoted: message });

        // Wait 2 seconds
        await sleep(2000);

        // Send code separately for easy copying
        await sock.sendMessage(chatId, {
            text: `📋 *Code for copying:*\n\`\`\`${result.code}\`\`\``
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in pairCommand:', error);
        
        await sock.sendMessage(chatId, {
            text: `❌ *Unexpected Error Occurred*\n\n*Error Details:* ${error.message}\n\nPlease try again later or contact support.`
        }, { quoted: message });
    }
}

module.exports = { pairCommand };
