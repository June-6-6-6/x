/*by supreme*/

const os = require('os');
const settings = require('../settings.js');

async function pingCommand(sock, chatId, message) {
  try {
    const start = Date.now();
    const sentMsg = await sock.sendMessage(chatId, {
      text: '*🔹pong!...*'}, { quoted: message }
    );

    const ping = Date.now() - start;
    // Format ping with decimal points
    const formattedPing = ping.toFixed(2);
    const response = `🔸 *June-X Speed: ${formattedPing} ms*`;

    await sock.sendMessage(chatId, {
      text: response,
      edit: sentMsg.key // Edit the original message
    });   
    
  } catch (error) {
    console.error('Ping error:', error);
    await sock.sendMessage(chatId, { text: 'Failed to measure speed.' });
  }
}

module.exports = pingCommand;
