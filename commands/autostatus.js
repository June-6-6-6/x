const fs = require('fs');
const path = require('path');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: false,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '',
            newsletterName: '',
            serverMessageId: -1
        }
    }
};

// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json'); // Fixed: dirname to __dirname

// Default emoji list for random reactions
const defaultEmojis = ['❤️', '🔥', '👍', '👏', '🎉', '💫', '✨', '🌟', '💖', '😊', '😍', '🤩', '🥰', '😎', '🖤'];

// Initialize config file if it doesn't exist
if (!fs.existsSync(configPath)) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ 
        enabled: false, 
        reactOn: false,
        customEmojis: [],
        useRandomEmojis: true
    }, null, 2));
}

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        // Check if sender is owner or sudo
        const { isSudo } = require('../lib/index');
        const senderId = msg.key.participant || msg.key.remoteJid;
        const senderIsSudo = await isSudo(senderId);
        const isOwner = msg.key.fromMe || senderIsSudo;
        
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used by the owner!',
                ...channelInfo
            });
            return;
        }

        // Read current config
        let config = JSON.parse(fs.readFileSync(configPath));

        // If no arguments, show current status
        if (!args || args.length === 0) {
            const status = config.enabled ? '✅ enabled' : '❌ disabled';
            const reactStatus = config.reactOn ? '✅ enabled' : '❌ disabled';
            const randomEmojiStatus = config.useRandomEmojis ? '✅ enabled' : '❌ disabled';
            const customEmojiCount = config.customEmojis ? config.customEmojis.length : 0;
            
            let emojiInfo = '';
            if (config.customEmojis && config.customEmojis.length > 0) {
                emojiInfo = `\n🎨 Custom Emojis: ${config.customEmojis.join(' ')}`;
            }
            
            await sock.sendMessage(chatId, { 
                text: `🔄 *Auto Status Settings*\n\n📱 Auto Status View: ${status}\n💫 Status Reactions: ${reactStatus}\n🎲 Random Emojis: ${randomEmojiStatus}\n📊 Custom Emojis: ${customEmojiCount}${emojiInfo}\n\n*Commands:*\n• .autostatus on/off\n• .autostatus react on/off\n• .autostatus emoji add/remove/list/clear\n• .autostatus emoji random on/off`,
                ...channelInfo
            },{ quoted: msg });
            return;
        }

        // Handle on/off commands
        const command = args[0].toLowerCase();
        
        if (command === 'on') {
            config.enabled = true;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await sock.sendMessage(chatId, { 
                text: '✅ Auto status view enabled!',
                ...channelInfo
            },{ quoted: msg });
        } else if (command === 'off') {
            config.enabled = false;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await sock.sendMessage(chatId, { 
                text: '❌ Auto status view disabled!',
                ...channelInfo
            });
        } else if (command === 'react') {
            if (!args[1]) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Use: .autostatus react on/off',
                    ...channelInfo
                },{ quoted: msg });
                return;
            }
            
            const reactCommand = args[1].toLowerCase();
            if (reactCommand === 'on') {
                config.reactOn = true;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await sock.sendMessage(chatId, { 
                    text: '💫 Status reactions enabled!',
                    ...channelInfo
                },{ quoted: msg });
            } else if (reactCommand === 'off') {
                config.reactOn = false;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await sock.sendMessage(chatId, { 
                    text: '❌ Status reactions disabled!',
                    ...channelInfo
                },{ quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: '❌ Use: .autostatus react on/off',
                    ...channelInfo
                },{ quoted: msg });
            }
        } else if (command === 'emoji') {
            if (!args[1]) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Use: .autostatus emoji add/remove/list/clear/random',
                    ...channelInfo
                },{ quoted: msg });
                return;
            }

            const emojiCommand = args[1].toLowerCase();
            
            switch (emojiCommand) {
                case 'add':
                    if (!args[2]) {
                        await sock.sendMessage(chatId, { 
                            text: '❌ Use: .autostatus emoji add ❤️',
                            ...channelInfo
                        },{ quoted: msg });
                        return;
                    }
                    
                    if (!config.customEmojis) config.customEmojis = [];
                    
                    const emojiToAdd = args[2];
                    if (config.customEmojis.includes(emojiToAdd)) {
                        await sock.sendMessage(chatId, { 
                            text: `❌ ${emojiToAdd} already exists!`,
                            ...channelInfo
                        },{ quoted: msg });
                        return;
                    }
                    
                    config.customEmojis.push(emojiToAdd);
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    await sock.sendMessage(chatId, { 
                        text: `✅ ${emojiToAdd} added! (Total: ${config.customEmojis.length})`,
                        ...channelInfo
                    },{ quoted: msg });
                    break;
                    
                case 'remove':
                    if (!args[2]) {
                        await sock.sendMessage(chatId, { 
                            text: '❌ Use: .autostatus emoji remove ❤️',
                            ...channelInfo
                        },{ quoted: msg });
                        return;
                    }
                    
                    if (!config.customEmojis?.length) {
                        await sock.sendMessage(chatId, { 
                            text: '❌ No custom emojis!',
                            ...channelInfo
                        },{ quoted: msg });
                        return;
                    }
                    
                    const emojiToRemove = args[2];
                    const index = config.customEmojis.indexOf(emojiToRemove);
                    if (index === -1) {
                        await sock.sendMessage(chatId, { 
                            text: `❌ ${emojiToRemove} not found!`,
                            ...channelInfo
                        },{ quoted: msg });
                        return;
                    }
                    
                    config.customEmojis.splice(index, 1);
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    await sock.sendMessage(chatId, { 
                        text: `✅ ${emojiToRemove} removed! (Remaining: ${config.customEmojis.length})`,
                        ...channelInfo
                    },{ quoted: msg });
                    break;
                    
                case 'list':
                    if (!config.customEmojis?.length) {
                        await sock.sendMessage(chatId, { 
                            text: '📝 No custom emojis. Using default emojis.',
                            ...channelInfo
                        },{ quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { 
                            text: `📝 Custom Emojis (${config.customEmojis.length}):\n${config.customEmojis.join(' ')}`,
                            ...channelInfo
                        },{ quoted: msg });
                    }
                    break;
                    
                case 'clear':
                    if (!config.customEmojis?.length) {
                        await sock.sendMessage(chatId, { 
                            text: '❌ No custom emojis to clear!',
                            ...channelInfo
                        },{ quoted: msg });
                        return;
                    }
                    
                    const clearedCount = config.customEmojis.length;
                    config.customEmojis = [];
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    await sock.sendMessage(chatId, { 
                        text: `✅ Cleared ${clearedCount} emojis!`,
                        ...channelInfo
                    },{ quoted: msg });
                    break;
                    
                case 'random':
                    if (!args[2]) {
                        await sock.sendMessage(chatId, { 
                            text: '❌ Use: .autostatus emoji random on/off',
                            ...channelInfo
                        },{ quoted: msg });
                        return;
                    }
                    
                    const randomMode = args[2].toLowerCase();
                    if (randomMode === 'on') {
                        config.useRandomEmojis = true;
                        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                        await sock.sendMessage(chatId, { 
                            text: '🎲 Random emoji mode enabled!',
                            ...channelInfo
                        },{ quoted: msg });
                    } else if (randomMode === 'off') {
                        config.useRandomEmojis = false;
                        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                        await sock.sendMessage(chatId, { 
                            text: '📋 Random emoji mode disabled!',
                            ...channelInfo
                        },{ quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { 
                            text: '❌ Use: .autostatus emoji random on/off',
                            ...channelInfo
                        });
                    }
                    break;
                    
                default:
                    await sock.sendMessage(chatId, { 
                        text: '❌ Use: .autostatus emoji add/remove/list/clear/random',
                        ...channelInfo
                    },{ quoted: msg });
            }
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid command! Use:\n.autostatus on/off\n.autostatus react on/off\n.autostatus emoji',
                ...channelInfo
            },{ quoted: msg });
        }

    } catch (error) {
        console.error('Error in autostatus command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error: ' + error.message,
            ...channelInfo
        },{ quoted: msg });
    }
}

// Function to check if auto status is enabled
function isAutoStatusEnabled() {
    try {
        if (!fs.existsSync(configPath)) return false;
        const config = JSON.parse(fs.readFileSync(configPath));
        return config.enabled === true;
    } catch (error) {
        console.error('Error checking auto status config:', error);
        return false;
    }
}

// Function to check if status reactions are enabled
function isStatusReactionEnabled() {
    try {
        if (!fs.existsSync(configPath)) return false;
        const config = JSON.parse(fs.readFileSync(configPath));
        return config.reactOn === true;
    } catch (error) {
        console.error('Error checking status reaction config:', error);
        return false;
    }
}

// Function to get random emoji
function getRandomEmoji() {
    try {
        if (!fs.existsSync(configPath)) {
            return defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
        }
        
        const config = JSON.parse(fs.readFileSync(configPath));
        
        // If random emojis are disabled and custom emojis exist, use only custom emojis
        if (!config.useRandomEmojis && config.customEmojis && config.customEmojis.length > 0) {
            const randomIndex = Math.floor(Math.random() * config.customEmojis.length);
            return config.customEmojis[randomIndex];
        }
        
        // Combine custom emojis with default emojis
        const availableEmojis = [...defaultEmojis];
        if (config.customEmojis && config.customEmojis.length > 0) {
            availableEmojis.push(...config.customEmojis);
        }
        
        const randomIndex = Math.floor(Math.random() * availableEmojis.length);
        return availableEmojis[randomIndex];
    } catch (error) {
        console.error('Error getting random emoji:', error);
        return defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
    }
}

// Function to react to status using proper method
async function reactToStatus(sock, statusKey) {
    try {
        if (!isStatusReactionEnabled()) return;

        const randomEmoji = getRandomEmoji();

        await sock.sendReaction(
            'status@broadcast',
            randomEmoji,
            statusKey.id
        );
        
    } catch (error) {
        console.error('❌ Error reacting to status:', error.message);
    }
}

// Function to handle status updates
async function handleStatusUpdate(sock, status) {
    try {
        if (!isAutoStatusEnabled()) return;

        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        let statusKey = null;

        // Handle different status update formats
        if (status.messages && status.messages.length > 0) {
            const msg = status.messages[0];
            if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                statusKey = msg.key;
            }
        } else if (status.key && status.key.remoteJid === 'status@broadcast') {
            statusKey = status.key;
        } else if (status.reaction && status.reaction.key.remoteJid === 'status@broadcast') {
            statusKey = status.reaction.key;
        }

        if (statusKey) {
            try {
                await sock.readMessages([statusKey]);
                await reactToStatus(sock, statusKey);
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    console.log('⚠️ Rate limit hit, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await sock.readMessages([statusKey]);
                } else {
                    console.error('Error reading status:', err.message);
                }
            }
        }

    } catch (error) {
        console.error('❌ Error in auto status view:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate,
    isAutoStatusEnabled,
    isStatusReactionEnabled
};
