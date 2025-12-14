const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function gitcloneCommand(sock, chatId, message) {
    /*━━━━━━━━━━━━━━━━━━━━*/
    // fake contact 
    /*━━━━━━━━━━━━━━━━━━━━*/
   
    function createFakeContact(message) {
        return {
            key: {
                participants: "0@s.whatsapp.net",
                remoteJid: "status@broadcast",
                fromMe: false,
                id: "JUNE-X"
            },
            message: {
                contactMessage: {
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE MD\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            },
            participant: "0@s.whatsapp.net"
        };
    }

    try {
        const fkontak = createFakeContact(message);
        const pushname = message.pushName || "Unknown User";
        
        // Ask for GitHub repository URL
        if (!message.text || message.text.split(' ').length < 2) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Usage:* .gitclone <github-repo-url>\n\n*Example:* .gitclone https://github.com/vinpink2/June-md' 
            }, { quoted: fkontak });
            return;
        }

        const repoUrl = message.text.split(' ')[1].trim();
        
        // Extract username and repo name from URL
        const urlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!urlMatch) {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid GitHub URL format. Please provide a valid GitHub repository URL.' 
            }, { quoted: fkontak });
            return;
        }

        const username = urlMatch[1];
        const repoName = urlMatch[2].replace('.git', '');
        
        // Fetch repository data
        const apiUrl = `https://api.github.com/repos/${username}/${repoName}`;
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error('Repository not found. Check the URL and try again.');
            }
            throw new Error(`GitHub API Error: ${res.status}`);
        }
        
        const json = await res.json();

        // Generate git clone command
        const gitCloneCmd = `git clone ${json.clone_url}`;
        const sshCloneCmd = `git clone git@github.com:${username}/${repoName}.git`;
        
        // Create informative message
        let txt = `🔹  *𝙶𝙸𝚃 𝙲𝙻𝙾𝙽𝙴 𝙲𝙾𝙼𝙼𝙰𝙽𝙳*\n\n`;
        txt += `🔸  *Repository* : ${json.full_name}\n`;
        txt += `🔸  *Description* : ${json.description || 'No description'}\n`;
        txt += `🔸  *Language* : ${json.language || 'Not specified'}\n`;
        txt += `🔸  *Stars* : ⭐ ${json.stargazers_count}\n`;
        txt += `🔸  *Forks* : 🍴 ${json.forks_count}\n`;
        txt += `🔸  *Last Updated* : ${moment(json.updated_at).format('DD/MM/YY - HH:mm:ss')}\n\n`;
        
        txt += `🔹  *Clone with HTTPS:*\n\`\`\`${gitCloneCmd}\`\`\`\n`;
        txt += `🔹  *Clone with SSH:*\n\`\`\`${sshCloneCmd}\`\`\`\n`;
        
        txt += `🔹  *Alternative:*\n`;
        txt += `• Download ZIP: ${json.html_url}/archive/refs/heads/${json.default_branch}.zip\n\n`;
        
        txt += `Hey👋 ${pushname}, _Use the commands above to clone this repository!_`;

        // Send with image (using same image as githubCommand)
        const imgPath = path.join(__dirname, '../assets/menu2.jpg');
        const imgBuffer = fs.readFileSync(imgPath);

        await sock.sendMessage(chatId, {
            image: imgBuffer,
            caption: txt,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '@newsletter',
                    newsletterName: 'June Official',
                    serverMessageId: -1
                }
            }
        }, { quoted: fkontak });

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '⚡', key: message.key }
        });

    } catch (error) {
        console.error('Git Clone Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}\n\nPlease make sure:\n1. The repository URL is correct\n2. The repository is public\n3. You have internet connection` 
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
