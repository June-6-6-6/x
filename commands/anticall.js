const fs = require('fs');

const antiCallFile = './anticall.json';

// Ensure JSON file exists
if (!fs.existsSync(antiCallFile)) {
    const initialData = {
        settings: {},
        callLogs: [],
        blockedNumbers: [],
        lastCacheClear: new Date().toISOString()
    };
    fs.writeFileSync(antiCallFile, JSON.stringify(initialData, null, 2));
}

// Load anti-call settings
function loadAntiCall() {
    try {
        const data = fs.readFileSync(antiCallFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading anti-call settings:', error);
        return { settings: {}, callLogs: [], blockedNumbers: [], lastCacheClear: new Date().toISOString() };
    }
}

// Save anti-call settings
function saveAntiCall(data) {
    try {
        fs.writeFileSync(antiCallFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving anti-call settings:', error);
    }
}

// Utility function to clean JID
function cleanJid(jid) {
    if (!jid) return jid;
    
    // Remove device suffix if present
    const clean = jid.split(':')[0];
    
    // If it already has a domain, return as is
    if (clean.includes('@')) {
        return clean;
    }
    
    // Otherwise, assume it's a regular WhatsApp number
    return clean + '@s.whatsapp.net';
}

// Setup anti-call listener
let antiCallListenerAttached = false;

// Track handled calls to avoid duplicates
const handledCalls = new Map();
const sentMessages = new Map();

// Last cache clear time
let lastAutoClearTime = Date.now();

// Clean up old entries periodically (every minute for short-term cache)
setInterval(() => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Clean up old handled calls (older than 5 minutes)
    for (const [callId, timestamp] of handledCalls.entries()) {
        if (now - timestamp > fiveMinutes) {
            handledCalls.delete(callId);
        }
    }
    
    // Clean up old sent messages (older than 5 minutes)
    for (const [callId, timestamp] of sentMessages.entries()) {
        if (now - timestamp > fiveMinutes) {
            sentMessages.delete(callId);
        }
    }
    
    // Auto-clear all cache every 24 hours (86,400,000 milliseconds)
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (now - lastAutoClearTime > twentyFourHours) {
        console.log('🔄 Auto-clearing call cache after 24 hours...');
        handledCalls.clear();
        sentMessages.clear();
        lastAutoClearTime = now;
        
        // Update last clear time in JSON file
        const antiCallData = loadAntiCall();
        antiCallData.lastCacheClear = new Date().toISOString();
        saveAntiCall(antiCallData);
        
        console.log('✅ Call cache auto-cleared successfully');
    }
}, 60000); // Check every minute

function setupAntiCallListener(sock) {
    console.log('🔧 Setting up anti-call listener...');
    
    // Listen for incoming calls
    sock.ev.on('call', async (callArray) => {
        try {
            // Handle both single call and array of calls
            const calls = Array.isArray(callArray) ? callArray : [callArray];
            
            for (const call of calls) {
                console.log('📞 Incoming call detected:', call);
                
                const antiCallData = loadAntiCall();
                const settings = antiCallData.settings || {};
                const blockedNumbers = antiCallData.blockedNumbers || [];
                const callLogs = antiCallData.callLogs || [];
                
                // Get the bot's JID
                const botJid = cleanJid(sock.user?.id);
                const userSettings = settings[botJid];
                
                console.log(`Checking settings for bot ${botJid}:`, userSettings);
                
                // Check if anti-call is enabled for the bot
                if (!userSettings || !userSettings.enabled) {
                    console.log('Anti-call not enabled for bot, allowing call');
                    return;
                }
                
                const fromJid = call.from;
                const callId = call.id;
                console.log(`Call from: ${fromJid}, Call ID: ${callId}, Status: ${call.status}`);
                
                // Only handle "offer" status calls (initial call)
                // This prevents handling the same call multiple times
                if (call.status !== 'offer') {
                    console.log(`Skipping call with status: ${call.status}`);
                    return;
                }
                
                // Check if we've already handled this call
                if (handledCalls.has(callId)) {
                    console.log(`Already handled call ${callId}, skipping`);
                    return;
                }
                
                // Mark this call as handled
                handledCalls.set(callId, Date.now());
                
                // Handle the call based on mode
                if (userSettings.mode === 'block') {
                    // Block the caller
                    try {
                        await sock.updateBlockStatus(fromJid, 'block');
                        console.log(`✅ Blocked ${fromJid}`);
                        
                        // Add to blocked numbers list
                        const alreadyBlocked = blockedNumbers.some(b => b.number === fromJid);
                        if (!alreadyBlocked) {
                            blockedNumbers.push({
                                number: fromJid,
                                blockedAt: new Date().toISOString(),
                                reason: 'Anti-call auto-block'
                            });
                        }
                    } catch (blockError) {
                        console.error('Error blocking user:', blockError);
                    }
                }
                
                // Decline the call
                try {
                    await sock.rejectCall(callId, fromJid);
                    console.log(`✅ Declined call from ${fromJid}`);
                    
                    // Log the call
                    callLogs.push({
                        from: fromJid,
                        timestamp: new Date().toISOString(),
                        action: userSettings.mode,
                        messageSent: false
                    });
                    
                    // Save updated data
                    antiCallData.blockedNumbers = blockedNumbers;
                    antiCallData.callLogs = callLogs;
                    saveAntiCall(antiCallData);
                    
                    // Send auto-message if enabled
                    if (userSettings.autoMessage && userSettings.message) {
                        // Check if we've already sent a message for this call
                        if (!sentMessages.has(callId)) {
                            setTimeout(async () => {
                                try {
                                    await sock.sendMessage(fromJid, { 
                                        text: userSettings.message 
                                    });
                                    console.log(`✅ Sent auto-message to ${fromJid}`);
                                    
                                    // Update log to show message was sent
                                    const logIndex = callLogs.findIndex(log => 
                                        log.from === fromJid && 
                                        Math.abs(new Date(log.timestamp).getTime() - new Date().getTime()) < 5000
                                    );
                                    if (logIndex !== -1) {
                                        callLogs[logIndex].messageSent = true;
                                        antiCallData.callLogs = callLogs;
                                        saveAntiCall(antiCallData);
                                    }
                                    
                                    sentMessages.set(callId, Date.now());
                                } catch (msgError) {
                                    console.error('Error sending auto-message:', msgError);
                                }
                            }, 1000); // Delay message by 1 second
                        }
                    }
                } catch (rejectError) {
                    console.error('Error rejecting call:', rejectError);
                }
            }
        } catch (error) {
            console.error('Error in call handler:', error);
        }
    });
    
    console.log('✅ Anti-call listener setup complete');
}

async function anticallCommand(sock, chatId, message, args) {
    // Get sender's JID
    let sender = message.key.participant || (message.key.fromMe ? sock.user.id : message.key.remoteJid);
    sender = cleanJid(sender);
    
    // Load settings
    const antiCallData = loadAntiCall();
    const settings = antiCallData.settings || {};
    const blockedNumbers = antiCallData.blockedNumbers || [];
    const callLogs = antiCallData.callLogs || [];
    const lastCacheClear = antiCallData.lastCacheClear || new Date().toISOString();
    
    const subCommand = args[0]?.toLowerCase();
    const action = args[1]?.toLowerCase();
    
    // Get bot's JID for settings
    const botJid = cleanJid(sock.user?.id);
    
    // Attach listener if not already attached
    if (!antiCallListenerAttached) {
        setupAntiCallListener(sock);
        antiCallListenerAttached = true;
    }
    
    // Handle different subcommands
    if (subCommand === 'status') {
        const userSettings = settings[botJid] || {
            enabled: false,
            mode: 'decline',
            autoMessage: false,
            message: "Sorry, I don't accept calls. Please message me instead."
        };
        
        let statusText = `📞 *Anti-call Status*\n\n`;
        statusText += `• Enabled: ${userSettings.enabled ? '✅ Yes' : '❌ No'}\n`;
        statusText += `• Bot JID: ${botJid}\n`;
        
        if (userSettings.enabled) {
            statusText += `• Mode: ${userSettings.mode.toUpperCase()}\n`;
            statusText += `• Auto Message: ${userSettings.autoMessage ? '✅ Yes' : '❌ No'}\n`;
            if (userSettings.autoMessage) {
                statusText += `• Message: ${userSettings.message}\n`;
            }
        }
        
        statusText += `\n📊 *Statistics*\n`;
        statusText += `• Blocked numbers: ${blockedNumbers.length}\n`;
        statusText += `• Total calls handled: ${callLogs.length}\n`;
        statusText += `• Currently tracking: ${handledCalls.size} calls\n`;
        
        // Calculate time until next auto-clear
        const nextClearTime = new Date(new Date(lastCacheClear).getTime() + 24 * 60 * 60 * 1000);
        const timeUntilClear = nextClearTime - new Date();
        const hoursUntilClear = Math.floor(timeUntilClear / (1000 * 60 * 60));
        const minutesUntilClear = Math.floor((timeUntilClear % (1000 * 60 * 60)) / (1000 * 60));
        
        statusText += `• Next auto-clear: ${hoursUntilClear}h ${minutesUntilClear}m\n`;
        statusText += `• Last cache clear: ${new Date(lastCacheClear).toLocaleString()}\n`;
        
        // Show last 5 calls
        if (callLogs.length > 0) {
            statusText += `\n📝 *Recent Calls:*\n`;
            const recentCalls = callLogs.slice(-5).reverse();
            recentCalls.forEach((log, index) => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                const date = new Date(log.timestamp).toLocaleDateString();
                statusText += `${index + 1}. ${log.from} (${date} ${time}) - ${log.action}\n`;
            });
        }
        
        // Show listener status
        statusText += `\n🔧 *Listener Status:* ${antiCallListenerAttached ? '✅ Active' : '❌ Inactive'}`;
        
        await sock.sendMessage(chatId, { text: statusText }, { quoted: message });
    }
    else if (subCommand === 'enable') {
        if (!action || !['decline', 'block'].includes(action)) {
            return sock.sendMessage(chatId, { 
                text: '⚙️ *Anti-call Setup*\n\nUsage: `.anticall enable [mode]`\n\nAvailable modes:\n• `decline` - Automatically decline calls\n• `block` - Automatically block callers\n\nExample: `.anticall enable decline`' 
            }, { quoted: message });
        }
        
        settings[botJid] = {
            enabled: true,
            mode: action,
            autoMessage: settings[botJid]?.autoMessage || false,
            message: settings[botJid]?.message || "Sorry, I don't accept calls. Please message me instead.",
            lastUpdated: new Date().toISOString()
        };
        
        antiCallData.settings = settings;
        saveAntiCall(antiCallData);
        
        await sock.sendMessage(chatId, { 
            text: `✅ *Anti-call enabled!*\n\nBot JID: ${botJid}\nMode: *${action.toUpperCase()}*\n\nCalls will now be automatically ${action === 'block' ? 'blocked' : 'declined'}.\n\nTo set an auto-reply message:\n\`.anticall message [your message]\`\n\nTo disable: \`.anticall disable\`` 
        }, { quoted: message });
    }
    else if (subCommand === 'disable') {
        if (settings[botJid]) {
            settings[botJid].enabled = false;
            antiCallData.settings = settings;
            saveAntiCall(antiCallData);
            await sock.sendMessage(chatId, { 
                text: '❌ *Anti-call disabled!*\n\nCalls will now come through normally.' 
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { 
                text: 'ℹ️ Anti-call is already disabled for your account.' 
            }, { quoted: message });
        }
    }
    else if (subCommand === 'message') {
        const messageText = args.slice(1).join(' ').trim();
        
        if (!messageText) {
            return sock.sendMessage(chatId, { 
                text: 'Usage: `.anticall message [your message]`\n\nExample: `.anticall message Sorry, I don\'t accept calls. Please send a text message instead.`' 
            }, { quoted: message });
        }
        
        if (!settings[botJid]) {
            settings[botJid] = {
                enabled: false,
                mode: 'decline',
                autoMessage: true,
                message: messageText,
                lastUpdated: new Date().toISOString()
            };
        } else {
            settings[botJid].autoMessage = true;
            settings[botJid].message = messageText;
            settings[botJid].lastUpdated = new Date().toISOString();
        }
        
        antiCallData.settings = settings;
        saveAntiCall(antiCallData);
        
        await sock.sendMessage(chatId, { 
            text: `✅ *Auto-reply message set!*\n\nMessage: "${messageText}"\n\nThis message will be sent after ${settings[botJid]?.mode === 'block' ? 'blocking' : 'declining'} a call.\n\nTo enable anti-call: \`.anticall enable [decline/block]\`` 
        }, { quoted: message });
    }
    else if (subCommand === 'nomessage') {
        if (!settings[botJid]) {
            settings[botJid] = {
                enabled: settings[botJid]?.enabled || false,
                mode: settings[botJid]?.mode || 'decline',
                autoMessage: false,
                message: "Sorry, I don't accept calls. Please message me instead.",
                lastUpdated: new Date().toISOString()
            };
        } else {
            settings[botJid].autoMessage = false;
            settings[botJid].lastUpdated = new Date().toISOString();
        }
        
        antiCallData.settings = settings;
        saveAntiCall(antiCallData);
        
        await sock.sendMessage(chatId, { 
            text: '✅ *Auto-reply message disabled!*\n\nNo messages will be sent after calls.\n\nTo enable again: `.anticall message [your message]`' 
        }, { quoted: message });
    }
    else if (subCommand === 'clearhandled') {
        handledCalls.clear();
        sentMessages.clear();
        lastAutoClearTime = Date.now();
        
        // Update last clear time in JSON file
        antiCallData.lastCacheClear = new Date().toISOString();
        saveAntiCall(antiCallData);
        
        await sock.sendMessage(chatId, { 
            text: '✅ *Cleared call tracking cache!*\n\nThe bot will now track new calls from scratch.\n\nNext auto-clear: 24 hours from now.' 
        }, { quoted: message });
    }
    else if (subCommand === 'debug') {
        // Debug command to see what's happening
        let debugText = `🔍 *Anti-call Debug Info*\n\n`;
        debugText += `• Bot JID: ${botJid}\n`;
        debugText += `• Listener attached: ${antiCallListenerAttached}\n`;
        debugText += `• Currently tracking: ${handledCalls.size} calls\n`;
        debugText += `• Messages sent tracking: ${sentMessages.size}\n`;
        
        // Calculate time since last auto-clear
        const timeSinceLastClear = Date.now() - new Date(lastCacheClear).getTime();
        const hoursSinceLastClear = Math.floor(timeSinceLastClear / (1000 * 60 * 60));
        const minutesSinceLastClear = Math.floor((timeSinceLastClear % (1000 * 60 * 60)) / (1000 * 60));
        
        debugText += `• Time since last clear: ${hoursSinceLastClear}h ${minutesSinceLastClear}m\n`;
        debugText += `• Last cache clear: ${new Date(lastCacheClear).toLocaleString()}\n`;
        debugText += `• Current settings for bot:\n`;
        
        const botSettings = settings[botJid];
        if (botSettings) {
            for (const [key, value] of Object.entries(botSettings)) {
                debugText += `  ${key}: ${value}\n`;
            }
        } else {
            debugText += `  No settings found\n`;
        }
        
        debugText += `\n• Total blocked numbers: ${blockedNumbers.length}\n`;
        debugText += `• Total call logs: ${callLogs.length}\n`;
        
        // Show currently tracked calls
        if (handledCalls.size > 0) {
            debugText += `\n📞 *Currently tracked calls:*\n`;
            let i = 1;
            for (const [callId, timestamp] of handledCalls.entries()) {
                const timeAgo = Date.now() - timestamp;
                const minutesAgo = Math.floor(timeAgo / (1000 * 60));
                const secondsAgo = Math.floor((timeAgo % (1000 * 60)) / 1000);
                debugText += `${i}. ${callId} - ${minutesAgo}m ${secondsAgo}s ago\n`;
                i++;
            }
        }
        
        await sock.sendMessage(chatId, { text: debugText }, { quoted: message });
    }
    else if (subCommand === 'test') {
        // Test the anti-call feature
        const testNumber = args[1] || '1234567890@s.whatsapp.net';
        const botSettings = settings[botJid] || {
            enabled: false,
            mode: 'decline',
            autoMessage: false,
            message: "Test message"
        };
        
        let testText = `🔍 *Anti-call Test*\n\n`;
        testText += `Test from: ${testNumber}\n`;
        testText += `Bot JID: ${botJid}\n`;
        testText += `Enabled: ${botSettings.enabled ? 'Yes' : 'No'}\n`;
        
        if (botSettings.enabled) {
            testText += `Mode: ${botSettings.mode}\n`;
            testText += `Auto Message: ${botSettings.autoMessage ? 'Yes' : 'No'}\n`;
            if (botSettings.autoMessage) {
                testText += `Message: ${botSettings.message}\n`;
            }
            testText += `\n✅ Would ${botSettings.mode === 'block' ? 'block and decline' : 'decline'} call from ${testNumber}`;
        } else {
            testText += `\n❌ Anti-call is disabled. Calls would come through normally.`;
        }
        
        await sock.sendMessage(chatId, { text: testText }, { quoted: message });
    }
    else if (subCommand === 'blocklist') {
        if (blockedNumbers.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '📋 *Blocked Numbers*\n\nNo numbers are currently blocked.\n\nBlock a number: `.anticall block [number]`' 
            }, { quoted: message });
        } else {
            let listText = '📋 *Blocked Numbers*\n\n';
            blockedNumbers.forEach((number, index) => {
                const time = new Date(number.blockedAt).toLocaleString();
                listText += `${index + 1}. ${number.number}\n   Blocked: ${time}\n`;
                if (number.reason) {
                    listText += `   Reason: ${number.reason}\n`;
                }
                listText += '\n';
            });
            listText += `Total: ${blockedNumbers.length} numbers\n\nUnblock: \`.anticall unblock [number]\``;
            
            await sock.sendMessage(chatId, { text: listText }, { quoted: message });
        }
    }
    else if (subCommand === 'logs') {
        const limit = parseInt(args[1]) || 10;
        const filteredLogs = callLogs.slice(-limit).reverse();
        
        if (filteredLogs.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '📝 *Call Logs*\n\nNo calls have been handled yet.' 
            }, { quoted: message });
        } else {
            let logsText = `📝 *Call Logs* (Last ${filteredLogs.length})\n\n`;
            
            filteredLogs.forEach((log, index) => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                const date = new Date(log.timestamp).toLocaleDateString();
                logsText += `${index + 1}. *From:* ${log.from}\n`;
                logsText += `   *Time:* ${date} ${time}\n`;
                logsText += `   *Action:* ${log.action.toUpperCase()}\n`;
                if (log.messageSent) {
                    logsText += `   *Message:* Sent\n`;
                }
                logsText += '\n';
            });
            
            logsText += `Total calls: ${callLogs.length}`;
            
            await sock.sendMessage(chatId, { text: logsText }, { quoted: message });
        }
    }
    else {
        // Show help
        const helpText = `📞 *Anti-call Command*

• \`.anticall enable [decline/block]\` 
• \`.anticall disable\` 
• \`.anticall message [text]\` 
• \`.anticall nomessage\` 
• \`.anticall clearhandled\`
• \`.anticall blocklist\` 
• \`.anticall logs [limit]\`
• \`.anticall status\`
• \`.anticall debug\`
• \`.anticall test [number]\``;

        await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
    }
}

module.exports = {
anticallCommand
};
