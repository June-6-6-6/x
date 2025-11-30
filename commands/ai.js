const axios = require('axios');
const fetch = require('node-fetch');

/**
 * AI Command Handler for GPT and Gemini
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Message object
 */
async function aiCommand(sock, chatId, message) {
    try {
        // Extract text from message
        const text = extractMessageText(message);
        
        if (!text) {
            return await sendPromptMessage(sock, chatId, message);
        }

        // Parse command and query
        const { command, query } = parseCommand(text);
        
        if (!query) {
            return await sendEmptyQueryMessage(sock, chatId, message);
        }

        // Process AI request
        await processAIRequest(sock, chatId, message, command, query);
        
    } catch (error) {
        console.error('AI Command Error:', error);
        await sendErrorMessage(sock, chatId, message);
    }
}

/**
 * Extract text from message object
 */
function extractMessageText(message) {
    return message.message?.conversation || 
           message.message?.extendedTextMessage?.text;
}

/**
 * Parse command and query from text
 */
function parseCommand(text) {
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const query = parts.slice(1).join(' ').trim();
    
    return { command, query };
}

/**
 * Send initial prompt message
 */
async function sendPromptMessage(sock, chatId, message) {
    const promptText = "Please provide a question after .gpt or .gemini\n\n" +
                      "Example: .gpt write a basic html code";
    
    return await sock.sendMessage(chatId, { text: promptText }, { quoted: message });
}

/**
 * Send empty query message
 */
async function sendEmptyQueryMessage(sock, chatId, message) {
    return await sock.sendMessage(chatId, { 
        text: "Please provide a question after .gpt or .gemini" 
    }, { quoted: message });
}

/**
 * Send error message
 */
async function sendErrorMessage(sock, chatId, message) {
    return await sock.sendMessage(chatId, {
        text: "❌ An error occurred. Please try again later.",
        contextInfo: {
            mentionedJid: [message.key.participant || message.key.remoteJid],
            quotedMessage: message.message
        }
    }, { quoted: message });
}

/**
 * Process AI request based on command
 */
async function processAIRequest(sock, chatId, message, command, query) {
    // Show processing indicator
    await sock.sendMessage(chatId, {
        react: { text: '🤖', key: message.key }
    });

    try {
        if (command === '.gpt') {
            await handleGPTRequest(sock, chatId, message, query);
        } else if (command === '.gemini') {
            await handleGeminiRequest(sock, chatId, message, query);
        }
    } catch (error) {
        console.error('API Processing Error:', error);
        await sendAPIErrorMessage(sock, chatId, message);
    }
}

/**
 * Handle GPT API request
 */
async function handleGPTRequest(sock, chatId, message, query) {
    const apiUrl = `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(query)}`;
    const response = await axios.get(apiUrl);
    
    if (response.data?.status && response.data?.result) {
        await sock.sendMessage(chatId, {
            text: response.data.result
        }, { quoted: message });
    } else {
        throw new Error('Invalid response from GPT API');
    }
}

/**
 * Handle Gemini API request with fallback endpoints
 */
async function handleGeminiRequest(sock, chatId, message, query) {
    const geminiEndpoints = [
        `https://vapis.my.id/api/gemini?q=${encodeURIComponent(query)}`,
        `https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(query)}`,
        `https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(query)}`,
        `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(query)}`,
        `https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(query)}`,
        `https://api.giftedtech.my.id/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(query)}`
    ];

    for (const endpoint of geminiEndpoints) {
        try {
            const response = await fetch(endpoint);
            const data = await response.json();

            const answer = extractAnswer(data);
            if (answer) {
                await sock.sendMessage(chatId, {
                    text: answer
                }, { quoted: message });
                return; // Success, exit loop
            }
        } catch (error) {
            console.log(`Endpoint failed: ${endpoint}`, error.message);
            continue; // Try next endpoint
        }
    }
    
    throw new Error('All Gemini endpoints failed');
}

/**
 * Extract answer from Gemini API response
 */
function extractAnswer(data) {
    return data.message || data.data || data.answer || data.result || null;
}

/**
 * Send API error message
 */
async function sendAPIErrorMessage(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text: "❌ Failed to get response. Please try again later.",
        contextInfo: {
            mentionedJid: [message.key.participant || message.key.remoteJid],
            quotedMessage: message.message
        }
    }, { quoted: message });
}

module.exports = aiCommand;
