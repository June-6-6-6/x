const fs = require('fs');
const path = require('path');
const { channelInfo } = require('../lib/messageConfig');

async function unbanCommand(sock, chatId, message, msg, ownerNumber) {
    // Check if sender is owner
    const sender = msg.key.participant || msg.key.remoteJid;
    if (sender !== ownerNumber && !sender.includes(ownerNumber)) {
        await sock.sendMessage(chatId, { 
            text: '❌ This command is for owner only!',
            ...channelInfo 
        });
        return;
    }

    let userToUnban;
    let userToUnbanJid;
    
    // Check for mentioned users
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        userToUnbanJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        userToUnban = userToUnbanJid.split('@')[0];
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToUnbanJid = message.message.extendedTextMessage.contextInfo.participant;
        userToUnban = userToUnbanJid.split('@')[0];
    }
    // Check if user JID is provided in message text
    else if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
        const text = msg.message.conversation || msg.message.extendedTextMessage.text;
        const args = text.split(' ');
        if (args[1] && args[1].includes('@')) {
            userToUnbanJid = args[1].includes('.net') ? args[1] : args[1] + '@s.whatsapp.net';
            userToUnban = userToUnbanJid.split('@')[0];
        }
    }
    
    if (!userToUnbanJid) {
        await sock.sendMessage(chatId, { 
            text: '⚠️ Please mention the user or reply to their message to unban!\n\nUsage: *!unban @user* or reply to user\'s message with *!unban*', 
            ...channelInfo 
        });
        return;
    }

    try {
        // Ensure banned.json file exists
        const bannedFile = './data/banned.json';
        if (!fs.existsSync(bannedFile)) {
            fs.writeFileSync(bannedFile, JSON.stringify([]));
        }
        
        const bannedUsers = JSON.parse(fs.readFileSync(bannedFile));
        const index = bannedUsers.indexOf(userToUnbanJid);
        
        if (index > -1) {
            bannedUsers.splice(index, 1);
            fs.writeFileSync(bannedFile, JSON.stringify(bannedUsers, null, 2));
            
            await sock.sendMessage(chatId, { 
                text: `✅ Successfully unbanned @${userToUnban}!`,
                mentions: [userToUnbanJid],
                ...channelInfo 
            });
        } else {
            await sock.sendMessage(chatId, { 
                text: `ℹ️ @${userToUnban} is not in the banned list!`,
                mentions: [userToUnbanJid],
                ...channelInfo 
            });
        }
    } catch (error) {
        console.error('Error in unban command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to unban user!', 
            ...channelInfo 
        });
    }
}

module.exports = unbanCommand;
