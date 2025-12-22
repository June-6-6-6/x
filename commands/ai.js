const axios = require('axios');

/**
 * AI Command Handler
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
        await processAIRequest(sock, chatId, message, query);
        
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
           message.message?.extendedTextMessage?.text ||
           message.text;
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
    const promptText = "Please provide a question after !gpt\n\n" +
                      "Example: !gpt What is quantum computing?";
    
    return await sock.sendMessage(chatId, { text: promptText }, { quoted: message });
}

/**
 * Send empty query message
 */
async function sendEmptyQueryMessage(sock, chatId, message) {
    return await sock.sendMessage(chatId, { 
        text: "❌ Please provide a query.\nExample: !gpt What is quantum computing?" 
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
 * Process AI request
 */
async function processAIRequest(sock, chatId, message, query) {
    // Show processing indicator
    await sock.sendMessage(chatId, {
        react: { text: '🤖', key: message.key }
    });

    try {
        await handleAIAPIRequest(sock, chatId, message, query);
    } catch (error) {
        console.error('API Processing Error:', error);
        await sendAPIErrorMessage(sock, chatId, message, error);
    }
}

/**
 * Handle AI API request
 */
async function handleAIAPIRequest(sock, chatId, message, query) {
    const apiUrl = `https://api.zenzxz.my.id/api/ai/chatai?query=${encodeURIComponent(query)}&model=deepseek-v3`;
    
    const response = await axios.get(apiUrl);
    const data = response.data;
    
    // Extract answer from response
    const replyText = data?.data?.answer || "⚠️ No response from AI.";
    
    if (replyText !== "⚠️ No response from AI.") {
        await sock.sendMessage(chatId, {
            text: replyText
        }, { quoted: message });
    } else {
        throw new Error('No valid response from AI API');
    }
}

/**
 * Send API error message
 */
async function sendAPIErrorMessage(sock, chatId, message, error) {
    const errorMessage = error.response?.status === 429 
        ? "❌ Rate limit exceeded. Please try again later." 
        : "❌ Failed to reach AI API.";
    
    await sock.sendMessage(chatId, {
        text: errorMessage,
        contextInfo: {
            mentionedJid: [message.key.participant || message.key.remoteJid],
            quotedMessage: message.message
        }
    }, { quoted: message });
}

module.exports = aiCommand;
