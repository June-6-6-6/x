const axios = require('axios');
const { sleep } = require('../lib/myfunc');

async function pairCommand(sock, chatId, message, q) {
    try {
        if (!q) {
            return await sock.sendMessage(chatId, {
                text: "📱 *WhatsApp Pairing Code*\n\nPlease provide a valid WhatsApp number\n\n*📌 Usage:* .pair 91702395XXXX\n*Example:* .pair 917023951234"
            }, { quoted: message });
        }

        const numbers = q.split(',')
            .map((v) => v.replace(/[^0-9]/g, ''))
            .filter((v) => v.length > 5 && v.length < 20);

        if (numbers.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "❌ *Invalid Number Format*\n\nPlease use the correct format:\n• .pair 91702395XXXX\n• .pair 917023951234,917023951235"
            }, { quoted: message });
        }

        // Limit to 3 numbers at once to avoid spam
        if (numbers.length > 3) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ *Too Many Numbers*\n\nPlease provide maximum 3 numbers at a time.\nExample: .pair 917023951234,917023951235,917023951236"
            }, { quoted: message });
        }

        for (const number of numbers) {
            const whatsappID = number + '@s.whatsapp.net';
            const result = await sock.onWhatsApp(whatsappID);

            if (!result[0]?.exists) {
                await sock.sendMessage(chatId, {
                    text: `❌ *Number Not Registered*\n\n${number} is not registered on WhatsApp.`
                }, { quoted: message });
                continue; // Skip to next number instead of returning
            }

            // Send processing message
            await sock.sendMessage(chatId, {
                text: `⏳ *Processing Number:* ${number}\n\nPlease wait while we generate your pairing code...`
            }, { quoted: message });

            try {
                const response = await axios.get(`https://knight-bot-paircode.onrender.com/code?number=${number}`, {
                    timeout: 10000 // 10 second timeout
                });
                
                if (response.data && response.data.code) {
                    const code = response.data.code;
                    
                    if (code === "Service Unavailable") {
                        throw new Error('Service Unavailable');
                    }
                    
                    // Wait before sending code
                    await sleep(3000);
                    
                    // Send success message with code
                    await sock.sendMessage(chatId, {
                        text: `✅ *Pairing Code Generated*\n\n📱 *Number:* ${number}\n🔑 *Pairing Code:* ${code}\n\n💡 *How to use:*\n1. Open WhatsApp on your device\n2. Go to Linked Devices\n3. Enter this code to pair`
                    }, { quoted: message });

                    // Send code separately for easy copying
                    await sleep(1000);
                    await sock.sendMessage(chatId, {
                        text: `📋 *Code for easy copying:*\n\`\`\`${code}\`\`\``
                    }, { quoted: message });

                } else {
                    throw new Error('Invalid response from server');
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                
                let errorMessage;
                if (apiError.message === 'Service Unavailable') {
                    errorMessage = "🔧 *Service Temporarily Unavailable*\n\nThe pairing service is currently down. Please try again in a few minutes.";
                } else if (apiError.code === 'ECONNABORTED') {
                    errorMessage = "⏰ *Request Timeout*\n\nThe server took too long to respond. Please try again later.";
                } else if (apiError.response?.status === 404) {
                    errorMessage = "🌐 *Service Not Found*\n\nThe pairing service endpoint is currently unavailable.";
                } else {
                    errorMessage = "❌ *Failed to Generate Code*\n\nUnable to generate pairing code at the moment. Please try again later.";
                }
                
                await sock.sendMessage(chatId, {
                    text: errorMessage
                }, { quoted: message });
            }
            
            // Add delay between processing multiple numbers
            if (numbers.length > 1) {
                await sleep(2000);
            }
        }
    } catch (error) {
        console.error('Error in pairCommand:', error);
        await sock.sendMessage(chatId, {
            text: "🚨 *Unexpected Error*\n\nAn unexpected error occurred. Please try again later.\n\nIf this continues, contact support."
        }, { quoted: message });
    }
}

module.exports = pairCommand;
