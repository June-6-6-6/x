const fs = require('fs');
const path = require('path');

async function vcfCommand(sock, chatId, message) {
    try {
        // Restrict to groups only
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: "❌ This command can only be used in groups." 
            }, { quoted: message });
            return;
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        
        // Validate group size (minimum only, no upper limit)
        if (participants.length < 2) {
            await sock.sendMessage(chatId, { 
                text: "❌ Group must have at least 2 members." 
            }, { quoted: message });
            return;
        }

        // Notify group that file is being prepared
        await sock.sendMessage(chatId, { 
            text: `⏳ Preparing VCF file for *${groupMetadata.subject}*...\n_Please wait..._` 
        }, { quoted: message });

        // Generate VCF content
        let vcfContent = '';
        participants.forEach(participant => {
            const phoneNumber = participant.id.split('@')[0];
            const displayName = participant.notify || `User_${phoneNumber}`;
            
            vcfContent += `BEGIN:VCARD\n` +
                          `VERSION:3.0\n` +
                          `FN:${displayName}\n` +
                          `TEL;TYPE=CELL:+${phoneNumber}\n` +
                          `NOTE:From ${groupMetadata.subject}\n` +
                          `END:VCARD\n\n`;
        });

        // Create temp file
        const sanitizedGroupName = groupMetadata.subject.replace(/[^\w]/g, '_');
        const tempDir = path.join(__dirname, '../temp');
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const vcfPath = path.join(tempDir, `${sanitizedGroupName}_${Date.now()}.vcf`);
        fs.writeFileSync(vcfPath, vcfContent);

        // Delay before sending file (e.g., 3 seconds)
        setTimeout(async () => {
            try {
                // Send VCF file
                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(vcfPath),
                    mimetype: 'text/vcard',
                    fileName: `${sanitizedGroupName}_contacts.vcf`,
                    caption: `📇 *Group Contacts*\n\n` +
                             `🔗 Group: ${groupMetadata.subject}\n` +
                             `📑 Members: ${participants.length}`
                }, { quoted: message });

                // Cleanup
                setTimeout(() => {
                    try {
                        if (fs.existsSync(vcfPath)) {
                            fs.unlinkSync(vcfPath);
                        }
                    } catch (cleanupError) {
                        console.error('Error cleaning up VCF file:', cleanupError);
                    }
                }, 5000);
            } catch (sendError) {
                console.error('VCF Send Error:', sendError);
                await sock.sendMessage(chatId, { 
                    text: "❌ Failed to send VCF file. Please try again later." 
                }, { quoted: message });
            }
        }, 4000); // 4-second delay

    } catch (error) {
        console.error('VCF Error:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to generate VCF file. Please try again later." 
        }, { quoted: message });
    }
}

module.exports = vcfCommand;
