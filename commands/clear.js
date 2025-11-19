async function clearCommand(sock, chatId, userJid) {
    try {
        // Send initial status message
        const statusMessage = await sock.sendMessage(chatId, { 
            text: '🔄 Clearing bot messages...' 
        });

        // Fetch recent messages from the chat
        const messages = await sock.fetchMessagesFromWA(chatId, 100); // Get last 100 messages
        
        let botMessagesDeleted = 0;
        let userMessagesDeleted = 0;
        const deletionErrors = [];

        // Filter and delete messages
        for (const message of messages) {
            try {
                // Delete bot messages
                if (message.key.fromMe) {
                    await sock.sendMessage(chatId, { 
                        delete: message.key 
                    });
                    botMessagesDeleted++;
                }
                // Delete user's messages (optional - only delete messages from the command sender)
                else if (message.key.participant === userJid || message.key.remoteJid === userJid) {
                    await sock.sendMessage(chatId, { 
                        delete: message.key 
                    });
                    userMessagesDeleted++;
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                deletionErrors.push(error.message);
                console.error('Error deleting single message:', error);
            }
        }

        // Update status message with results
        let resultText = `✅ Clear operation completed!\n\n`;
        resultText += `🤖 Bot messages deleted: ${botMessagesDeleted}\n`;
        resultText += `👤 Your messages deleted: ${userMessagesDeleted}`;
        
        if (deletionErrors.length > 0) {
            resultText += `\n\n⚠️ Some messages couldn't be deleted: ${deletionErrors.length} errors`;
        }

        // Edit the original status message with results
        await sock.sendMessage(chatId, { 
            text: resultText,
            edit: statusMessage.key 
        });

        // Auto-delete the result message after 10 seconds
        setTimeout(async () => {
            try {
                await sock.sendMessage(chatId, { 
                    delete: statusMessage.key 
                });
            } catch (error) {
                console.error('Error auto-deleting status message:', error);
            }
        }, 10000);

    } catch (error) {
        console.error('Error in clear command:', error);
        
        // Send error message
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while clearing messages. Please try again later.' 
        });
    }
}

// Alternative version with different clearing modes
async function clearCommandAdvanced(sock, chatId, userJid, mode = 'bot') {
    /**
     * Modes:
     * - 'bot': Clear only bot messages (default)
     * - 'user': Clear only user's messages
     * - 'all': Clear both bot and user messages
     */
    
    try {
        const statusMessage = await sock.sendMessage(chatId, { 
            text: `🔄 Clearing ${mode} messages...` 
        });

        const messages = await sock.fetchMessagesFromWA(chatId, 200);
        let deletedCount = 0;
        const errors = [];

        for (const message of messages) {
            try {
                let shouldDelete = false;
                
                switch (mode) {
                    case 'bot':
                        shouldDelete = message.key.fromMe;
                        break;
                    case 'user':
                        shouldDelete = (message.key.participant === userJid || message.key.remoteJid === userJid);
                        break;
                    case 'all':
                        shouldDelete = message.key.fromMe || 
                                      (message.key.participant === userJid || message.key.remoteJid === userJid);
                        break;
                }

                if (shouldDelete) {
                    await sock.sendMessage(chatId, { 
                        delete: message.key 
                    });
                    deletedCount++;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } catch (error) {
                errors.push(error.message);
            }
        }

        // Send result
        const resultMessage = await sock.sendMessage(chatId, {
            text: `✅ Cleared ${deletedCount} ${mode} messages${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
        });

        // Delete status message
        await sock.sendMessage(chatId, { 
            delete: statusMessage.key 
        });

        // Auto-delete result after 8 seconds
        setTimeout(async () => {
            try {
                await sock.sendMessage(chatId, { 
                    delete: resultMessage.key 
                });
            } catch (error) {
                // Ignore auto-delete errors
            }
        }, 8000);

    } catch (error) {
        console.error('Error in clear command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to clear messages. Please try again.' 
        });
    }
}

module.exports = { 
    clearCommand, 
    clearCommandAdvanced 
};
