const axios = require('axios');
const { sleep } = require('../lib/myfunc');

async function pairCommand(sock, chatId, message, q) {
    try {
        if (!q) {
            return await sock.sendMessage(chatId, {
                text: "Please provide valid WhatsApp number\nExample: .pair 91702395XXXX\nOr multiple: .pair 91702395XXXX,918123456789",
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '',
                        newsletterName: ' MD',
                        serverMessageId: -1
                    }
                }
            });
        }

        const numbers = q.split(',')
            .map((v) => v.trim().replace(/[^0-9]/g, ''))
            .filter((v) => v.length > 5 && v.length < 20);

        // Remove duplicates
        const uniqueNumbers = [...new Set(numbers)];

        if (uniqueNumbers.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "Invalid number❌️ Please use the correct format!\nExample: .pair 91702395XXXX or .pair 91702395XXXX,918123456789",
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '',
                        newsletterName: ' MD',
                        serverMessageId: -1
                    }
                }
            });
        }

        if (uniqueNumbers.length > 5) {
            return await sock.sendMessage(chatId, {
                text: "Too many numbers! Please provide maximum 5 numbers at a time.",
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '',
                        newsletterName: ' MD',
                        serverMessageId: -1
                    }
                }
            });
        }

        await sock.sendMessage(chatId, {
            text: `Processing ${uniqueNumbers.length} number(s)... Please wait.`,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '@newsletter',
                    newsletterName: ' MD',
                    serverMessageId: -1
                }
            }
        });

        const results = [];
        
        for (const [index, number] of uniqueNumbers.entries()) {
            try {
                const whatsappID = number + '@s.whatsapp.net';
                const result = await sock.onWhatsApp(whatsappID);

                if (!result[0]?.exists) {
                    results.push({ number, status: 'error', message: 'Not registered on WhatsApp' });
                    continue; // Continue with next number instead of returning
                }

                // Add delay between API calls to avoid rate limiting
                if (index > 0) {
                    await sleep(2000);
                }

                const response = await axios.get(`https://knight-bot-paircode.onrender.com/code?number=${number}`, {
                    timeout: 10000 // 10 second timeout
                });
                
                if (response.data && response.data.code) {
                    const code = response.data.code;
                    if (code === "Service Unavailable") {
                        results.push({ number, status: 'error', message: 'Service temporarily unavailable' });
                        continue;
                    }
                    
                    results.push({ number, status: 'success', code });
                    
                } else {
                    results.push({ number, status: 'error', message: 'Invalid response from server' });
                }
                
            } catch (numberError) {
                console.error(`Error processing number ${number}:`, numberError);
                
                let errorMessage = 'Unknown error occurred';
                if (numberError.code === 'ECONNABORTED' || numberError.message.includes('timeout')) {
                    errorMessage = 'Request timeout';
                } else if (numberError.response?.status === 429) {
                    errorMessage = 'Rate limit exceeded';
                } else if (numberError.message === 'Service Unavailable') {
                    errorMessage = 'Service temporarily unavailable';
                }
                
                results.push({ number, status: 'error', message: errorMessage });
            }
        }

        // Generate summary message
        const successResults = results.filter(r => r.status === 'success');
        const errorResults = results.filter(r => r.status === 'error');

        let summaryMessage = `*Pairing Results:*\n\n`;
        
        if (successResults.length > 0) {
            summaryMessage += `*✅ Success (${successResults.length}):*\n`;
            successResults.forEach((result, index) => {
                summaryMessage += `${index + 1}. ${result.number}: ${result.code}\n`;
            });
            summaryMessage += '\n';
        }

        if (errorResults.length > 0) {
            summaryMessage += `*❌ Failed (${errorResults.length}):*\n`;
            errorResults.forEach((result, index) => {
                summaryMessage += `${index + 1}. ${result.number}: ${result.message}\n`;
            });
        }

        await sock.sendMessage(chatId, {
            text: summaryMessage,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '@newsletter',
                    newsletterName: ' MD',
                    serverMessageId: -1
                }
            }
        });

    } catch (error) {
        console.error('Critical error in pairCommand:', error);
        await sock.sendMessage(chatId, {
            text: "A critical error occurred. Please try again later.",
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '@newsletter',
                    newsletterName: ' MD',
                    serverMessageId: -1
                }
            }
        });
    }
}

module.exports = pairCommand;
