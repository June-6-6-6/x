const fs = require('fs');

const ANTICALL_PATH = './data/anticall.json';

// Read anti-call settings from file
function readSettings() {
    try {
        if (!fs.existsSync(ANTICALL_PATH)) {
            return {
                enabled: false,
                mode: 'warn', // 'block' or 'warn'
                customMessage: null,
                lastCall: null
            };
        }
        const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
        return JSON.parse(raw || '{}');
    } catch {
        return {
            enabled: false,
            mode: 'warn',
            customMessage: null,
            lastCall: null
        };
    }
}

// Write anti-call settings to file
function writeSettings(settings) {
    try {
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error writing anti-call settings:', error);
    }
}

// Update specific setting
function updateSetting(key, value) {
    const settings = readSettings();
    settings[key] = value;
    writeSettings(settings);
    return settings;
}

// Update multiple settings
function updateSettings(newSettings) {
    const settings = readSettings();
    Object.assign(settings, newSettings);
    writeSettings(settings);
    return settings;
}

async function anticallCommand(sock, chatId, message, args) {
    const sub = args ? args.trim().toLowerCase() : '';
    const settings = readSettings();

    if (!sub) {
        // Show help menu
        await sock.sendMessage(chatId, { 
            text: `🤖 *Anti-Call Command Menu* 🤖\n\n` +
                  `*Available Commands:*\n` +
                  `• .anticall on - Enable anti-call protection\n` +
                  `• .anticall off - Disable anti-call protection\n` +
                  `• .anticall block - Block and auto-end calls\n` +
                  `• .anticall warn - Warn callers then end call\n` +
                  `• .anticall message [text] - Set custom warning message\n` +
                  `• .anticall status - Show current settings\n` +
                  `• .anticall leave - Leave call with message\n` +
                  `• .anticall help - Show this menu\n\n` +
                  `*Example:* .anticall on`
        }, { quoted: message });
        return;
    }

    const parts = sub.split(' ');
    const command = parts[0];
    const param = parts.slice(1).join(' ');

    switch (command) {
        case 'on':
            updateSetting('enabled', true);
            await sock.sendMessage(chatId, { 
                text: `✅ *Anti-Call Protection ENABLED*\n\n` +
                      `Mode: ${settings.mode.toUpperCase()}\n` +
                      `Calls will now be automatically handled.`
            }, { quoted: message });
            break;

        case 'off':
            updateSetting('enabled', false);
            await sock.sendMessage(chatId, { 
                text: '❌ *Anti-Call Protection DISABLED*\n\nCalls will not be automatically handled.'
            }, { quoted: message });
            break;

        case 'block':
            updateSetting('mode', 'block');
            await sock.sendMessage(chatId, { 
                text: `🛡️ *Block Mode Activated*\n\n` +
                      `Calls will be automatically rejected without warning.`
            }, { quoted: message });
            break;

        case 'warn':
            updateSetting('mode', 'warn');
            await sock.sendMessage(chatId, { 
                text: `⚠️ *Warn Mode Activated*\n\n` +
                      `Callers will receive a warning message before call is ended.`
            }, { quoted: message });
            break;

        case 'message':
            if (!param.trim()) {
                await sock.sendMessage(chatId, { 
                    text: '⚠️ Please provide a message!\n' +
                          '*Usage:* .anticall message [your text here]\n' +
                          '*Example:* .anticall message Calls are not allowed in this group!'
                }, { quoted: message });
                return;
            }
            updateSetting('customMessage', param);
            await sock.sendMessage(chatId, { 
                text: `📝 *Custom Message Set*\n\n"${param}"`
            }, { quoted: message });
            break;

        case 'status':
            const statusText = `📊 *Anti-Call Status*\n\n` +
                               `• Enabled: ${settings.enabled ? '✅' : '❌'}\n` +
                               `• Mode: ${settings.mode.toUpperCase()}\n` +
                               `• Custom Message: ${settings.customMessage || 'Default'}\n` +
                               `• Last Call: ${settings.lastCall || 'None'}`;
            await sock.sendMessage(chatId, { text: statusText }, { quoted: message });
            break;

        case 'leave':
            // This would typically be triggered by an incoming call event
            await sock.sendMessage(chatId, { 
                text: '📞 *Call Handling*\n\n' +
                      'Use this in response to incoming call events. ' +
                      'The bot will leave calls automatically when anti-call is enabled.'
            }, { quoted: message });
            break;

        case 'help':
            await sock.sendMessage(chatId, { 
                text: `🔧 *Anti-Call Help*\n\n` +
                      `*Commands:*\n` +
                      `• .anticall on/off - Toggle protection\n` +
                      `• .anticall block - Auto-reject calls\n` +
                      `• .anticall warn - Warn then reject\n` +
                      `• .anticall message <text> - Set warning\n` +
                      `• .anticall status - Show settings\n` +
                      `• .anticall leave - Leave call\n\n` +
                      `*Note:* This feature works with call events.`
            }, { quoted: message });
            break;

        default:
            await sock.sendMessage(chatId, { 
                text: `❌ Unknown command: "${command}"\n\n` +
                      `Type ".anticall help" to see available commands.`
            }, { quoted: message });
    }
}

// Call event handler (should be in your main bot file)
async function handleCallEvent(sock, call) {
    try {
        const chatId = call.from;
        const settings = readSettings();

        if (!settings.enabled) return;

        // Update last call timestamp
        updateSetting('lastCall', new Date().toLocaleString());

        if (settings.mode === 'block') {
            // Auto-reject/block the call
            await sock.sendMessage(chatId, {
                text: '📞 *Call Blocked*\n\nThis call was automatically rejected.'
            });
            // Note: Actual call rejection depends on your WhatsApp library
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

module.exports = { 
    anticallCommand, 
    handleCallEvent,
    readSettings,
    updateSetting,
    updateSettings
};
