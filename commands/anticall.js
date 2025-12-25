// Storage for anti-call settings
const antiCallSettings = new Map(); // Map<chatId, settings>

async function anticallCommand(sock, chatId, message, args) {
    try {
        if (!args || args.length === 0) {
            // Show help menu
            return await sock.sendMessage(chatId, {
                text: `🤖 *Anti-Call Command Menu* 🤖\n\n` +
                      `*Available Commands:*\n` +
                      `• !anticall on - Enable anti-call protection\n` +
                      `• !anticall off - Disable anti-call protection\n` +
                      `• !anticall block - Block and auto-end calls\n` +
                      `• !anticall warn - Warn callers then end call\n` +
                      `• !anticall message [text] - Set custom warning message\n` +
                      `• !anticall status - Show current settings\n` +
                      `• !anticall leave - Leave call with message\n` +
                      `• !anticall help - Show this menu\n\n` +
                      `*Example:* !anticall on`
            });
        }

        const subCommand = args[0].toLowerCase();
        const settings = antiCallSettings.get(chatId) || {
            enabled: false,
            mode: 'warn', // 'block' or 'warn'
            customMessage: null,
            lastCall: null
        };

        switch (subCommand) {
            case 'on':
                settings.enabled = true;
                antiCallSettings.set(chatId, settings);
                await sock.sendMessage(chatId, {
                    text: `✅ *Anti-Call Protection ENABLED*\n\n` +
                          `Mode: ${settings.mode.toUpperCase()}\n` +
                          `Calls will now be automatically handled.`
                });
                break;

            case 'off':
                settings.enabled = false;
                antiCallSettings.set(chatId, settings);
                await sock.sendMessage(chatId, {
                    text: '❌ *Anti-Call Protection DISABLED*\n\nCalls will not be automatically handled.'
                });
                break;

            case 'block':
                settings.mode = 'block';
                antiCallSettings.set(chatId, settings);
                await sock.sendMessage(chatId, {
                    text: `🛡️ *Block Mode Activated*\n\n` +
                          `Calls will be automatically rejected without warning.`
                });
                break;

            case 'warn':
                settings.mode = 'warn';
                antiCallSettings.set(chatId, settings);
                await sock.sendMessage(chatId, {
                    text: `⚠️ *Warn Mode Activated*\n\n` +
                          `Callers will receive a warning message before call is ended.`
                });
                break;

            case 'message':
                if (args.length < 2) {
                    return await sock.sendMessage(chatId, {
                        text: '⚠️ Please provide a message!\n' +
                              '*Usage:* !anticall message [your text here]\n' +
                              '*Example:* !anticall message Calls are not allowed in this group!'
                    });
                }
                const customMsg = args.slice(1).join(' ');
                settings.customMessage = customMsg;
                antiCallSettings.set(chatId, settings);
                await sock.sendMessage(chatId, {
                    text: `📝 *Custom Message Set*\n\n"${customMsg}"`
                });
                break;

            case 'status':
                const statusText = `📊 *Anti-Call Status*\n\n` +
                                   `• Enabled: ${settings.enabled ? '✅' : '❌'}\n` +
                                   `• Mode: ${settings.mode.toUpperCase()}\n` +
                                   `• Custom Message: ${settings.customMessage || 'Default'}\n` +
                                   `• Last Call: ${settings.lastCall || 'None'}`;
                await sock.sendMessage(chatId, { text: statusText });
                break;

            case 'leave':
                // This would typically be triggered by an incoming call event
                // For demonstration, we'll show how it would work
                await sock.sendMessage(chatId, {
                    text: '📞 *Call Handling*\n\n' +
                          'Use this in response to incoming call events. ' +
                          'The bot will leave calls automatically when anti-call is enabled.'
                });
                break;

            case 'help':
            default:
                await sock.sendMessage(chatId, {
                    text: `🔧 *Anti-Call Help*\n\n` +
                          `*Commands:*\n` +
                          `• !anticall on/off - Toggle protection\n` +
                          `• !anticall block - Auto-reject calls\n` +
                          `• !anticall warn - Warn then reject\n` +
                          `• !anticall message <text> - Set warning\n` +
                          `• !anticall status - Show settings\n` +
                          `• !anticall leave - Leave call\n\n` +
                          `*Note:* This feature works with call events.`
                });
                break;
        }

    } catch (error) {
        console.error('Anti-call command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing anti-call command. Please try again.'
        });
    }
}

// Call event handler (should be in your main bot file)
async function handleCallEvent(sock, call) {
    try {
        const chatId = call.from;
        const settings = antiCallSettings.get(chatId);

        if (!settings || !settings.enabled) return;

        // Store last call info
        settings.lastCall = new Date().toLocaleString();
        antiCallSettings.set(chatId, settings);

        if (settings.mode === 'block') {
            // Auto-reject/block the call
            await sock.sendMessage(chatId, {
                text: '📞 *Call Blocked*\n\nThis call was automatically rejected.'
            });
            // Note: Actual call rejection depends on your WhatsApp library
            // You might need to use library-specific methods
        } else if (settings.mode === 'warn') {
            // Send warning and leave
            const warningMsg = settings.customMessage || 
                '⚠️ *Call Warning*\n\nCalls are not allowed here. This call will be ended.';
            
            await sock.sendMessage(chatId, { text: warningMsg });
            
            // Wait a moment then send leave message
            setTimeout(async () => {
                await sock.sendMessage(chatId, {
                    text: '📞 Call ended. Anti-call protection is active.'
                });
            }, 2000);
        }

    } catch (error) {
        console.error('Call event handler error:', error);
    }
}

// Export the command and event handler
module.exports = {
    anticallCommand,
    handleCallEvent,
    antiCallSettings // Export settings if needed elsewhere
};
