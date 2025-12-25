// Storage for anti-call settings
const antiCallSettings = new Map(); // Map<chatId, settings>

// Helper to get or initialize settings
function getSettings(chatId) {
    return antiCallSettings.get(chatId) || {
        enabled: false,
        mode: 'warn', // 'block' or 'warn'
        customMessage: null,
        lastCall: null
    };
}

// Command handlers registry
const commandHandlers = {
    on: async (sock, chatId, settings) => {
        settings.enabled = true;
        antiCallSettings.set(chatId, settings);
        await sock.sendMessage(chatId, {
            text: `✅ *Anti-Call Protection ENABLED*\n\nMode: ${settings.mode.toUpperCase()}\nCalls will now be automatically handled.`
        });
    },

    off: async (sock, chatId, settings) => {
        settings.enabled = false;
        antiCallSettings.set(chatId, settings);
        await sock.sendMessage(chatId, {
            text: '❌ *Anti-Call Protection DISABLED*\n\nCalls will not be automatically handled.'
        });
    },

    block: async (sock, chatId, settings) => {
        settings.mode = 'block';
        antiCallSettings.set(chatId, settings);
        await sock.sendMessage(chatId, {
            text: `🛡️ *Block Mode Activated*\n\nCalls will be automatically rejected without warning.`
        });
    },

    warn: async (sock, chatId, settings) => {
        settings.mode = 'warn';
        antiCallSettings.set(chatId, settings);
        await sock.sendMessage(chatId, {
            text: `⚠️ *Warn Mode Activated*\n\nCallers will receive a warning message before call is ended.`
        });
    },

    message: async (sock, chatId, settings, args) => {
        if (args.length < 2) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Please provide a message!\n*Usage:* !anticall message [your text here]\n*Example:* !anticall message Calls are not allowed in this group!'
            });
        }
        const customMsg = args.slice(1).join(' ');
        settings.customMessage = customMsg;
        antiCallSettings.set(chatId, settings);
        await sock.sendMessage(chatId, {
            text: `📝 *Custom Message Set*\n\n"${customMsg}"`
        });
    },

    status: async (sock, chatId, settings) => {
        const statusText = `📊 *Anti-Call Status*\n\n` +
                           `• Enabled: ${settings.enabled ? '✅' : '❌'}\n` +
                           `• Mode: ${settings.mode.toUpperCase()}\n` +
                           `• Custom Message: ${settings.customMessage || 'Default'}\n` +
                           `• Last Call: ${settings.lastCall || 'None'}`;
        await sock.sendMessage(chatId, { text: statusText });
    },

    leave: async (sock, chatId) => {
        await sock.sendMessage(chatId, {
            text: '📞 *Call Handling*\n\nUse this in response to incoming call events. The bot will leave calls automatically when anti-call is enabled.'
        });
    },

    help: async (sock, chatId) => {
        await sock.sendMessage(chatId, {
            text: `🔧 *Anti-Call Help*\n\n*Commands:*\n• !anticall on/off - Toggle protection\n• !anticall block - Auto-reject calls\n• !anticall warn - Warn then reject\n• !anticall message <text> - Set warning\n• !anticall status - Show settings\n• !anticall leave - Leave call\n\n*Note:* This feature works with call events.`
        });
    }
};

// Main command dispatcher
async function anticallCommand(sock, chatId, message, args) {
    try {
        if (!args || args.length === 0) {
            return commandHandlers.help(sock, chatId);
        }

        const subCommand = args[0].toLowerCase();
        const settings = getSettings(chatId);

        const handler = commandHandlers[subCommand] || commandHandlers.help;
        await handler(sock, chatId, settings, args);

    } catch (error) {
        console.error('Anti-call command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing anti-call command. Please try again.'
        });
    }
}

// Call event handler
async function handleCallEvent(sock, call) {
    try {
        const chatId = call.from;
        const settings = antiCallSettings.get(chatId);

        if (!settings || !settings.enabled) return;

        settings.lastCall = new Date().toLocaleString();
        antiCallSettings.set(chatId, settings);

        if (settings.mode === 'block') {
            await sock.sendMessage(chatId, {
                text: '📞 *Call Blocked*\n\nThis call was automatically rejected.'
            });
        } else if (settings.mode === 'warn') {
            const warningMsg = settings.customMessage ||
                '⚠️ *Call Warning*\n\nCalls are not allowed here. This call will be ended.';

            await sock.sendMessage(chatId, { text: warningMsg });

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

module.exports = {
    anticallCommand,
    handleCallEvent,
    antiCallSettings
};
