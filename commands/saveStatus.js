const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function saveStatusCommand(sock, chatId, message) {
    try {
        console.log('DEBUG: Command triggered', { chatId, fromMe: message.key.fromMe });
        
        // DEBUG 1: Check if sock has required methods
        if (!sock || !sock.sendMessage) {
            console.error('DEBUG: sock object is invalid or missing sendMessage method');
            return;
        }

        if (!message.key.fromMe) {
            console.log('DEBUG: Non-owner attempted to use command');
            await sock.sendMessage(chatId, { text: '😡 Command only for the owner.' });
            return;
        }

        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        console.log('DEBUG: Quoted message exists?', !!quotedMsg);
        
        if (!quotedMsg) {
            console.log('DEBUG: No quoted message found');
            await sock.sendMessage(chatId, { text: '⚠️ Please reply to a status update to save it.' });
            await sock.sendMessage(chatId, { react: { text: '🗑️', key: message.key } });
            return;
        }

        console.log('DEBUG: Quoted message keys:', Object.keys(quotedMsg));

        // DEBUG 2: Check for text message
        if (quotedMsg.extendedTextMessage?.text) {
            const text = quotedMsg.extendedTextMessage.text;
            console.log('DEBUG: Saving text status, length:', text.length);
            await sock.sendMessage(chatId, { text: `📝 *Saved Status Text*\n\n${text}\n\n✅ Status text saved successfully!` });
            await sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });
            return;
        }

        let statusMedia, mediaType;

        // DEBUG 3: Check for different message types
        if (quotedMsg.imageMessage) {
            console.log('DEBUG: Found image message');
            statusMedia = quotedMsg.imageMessage;
            mediaType = 'image';
            console.log('DEBUG: Image details:', {
                mimetype: statusMedia.mimetype,
                fileSize: statusMedia.fileLength,
                dimensions: `${statusMedia.width}x${statusMedia.height}`
            });
        } else if (quotedMsg.videoMessage) {
            console.log('DEBUG: Found video message');
            statusMedia = quotedMsg.videoMessage;
            mediaType = 'video';
            console.log('DEBUG: Video details:', {
                mimetype: statusMedia.mimetype,
                fileSize: statusMedia.fileLength,
                duration: statusMedia.seconds
            });
        } else {
            console.log('DEBUG: Unsupported message type in quoted message');
            await sock.sendMessage(chatId, { text: '❌ The replied message is not a valid status update.\n\nSupported: Text, Images, Videos' });
            return;
        }

        await sock.sendMessage(chatId, { text: '📥 Downloading status...' });

        try {
            // DEBUG 4: Check downloadMediaMessage parameters
            console.log('DEBUG: Attempting to download media, type:', mediaType);
            
            const buffer = await downloadMediaMessage(
                { 
                    message: { 
                        [mediaType === 'image' ? 'imageMessage' : 'videoMessage']: statusMedia 
                    },
                    key: message.key // Include key for context
                },
                'buffer',
                {},
                { 
                    logger: sock.logger || console, // Provide fallback logger
                    reuploadRequest: sock.updateMediaMessage 
                }
            );

            console.log('DEBUG: Download completed, buffer size:', buffer?.length || 0);

            if (!buffer || buffer.length === 0) {
                throw new Error('Downloaded buffer is empty');
            }

            const dirPath = path.join(__dirname, '..', 'saved_statuses');
            console.log('DEBUG: Directory path:', dirPath);
            
            if (!fs.existsSync(dirPath)) {
                console.log('DEBUG: Creating directory:', dirPath);
                fs.mkdirSync(dirPath, { recursive: true });
            }

            // DEBUG 5: Better file extension handling
            let extension = mediaType === 'image' ? 'jpg' : 'mp4';
            if (statusMedia.mimetype) {
                const mimeToExt = {
                    'image/jpeg': 'jpg',
                    'image/jpg': 'jpg',
                    'image/png': 'png',
                    'image/gif': 'gif',
                    'image/webp': 'webp',
                    'video/mp4': 'mp4',
                    'video/quicktime': 'mov',
                    'video/webm': 'webm'
                };
                extension = mimeToExt[statusMedia.mimetype] || extension;
            }

            const filename = `status_${Date.now()}.${extension}`;
            const filepath = path.join(dirPath, filename);
            console.log('DEBUG: Saving to file:', filepath);

            fs.writeFileSync(filepath, buffer);
            console.log('DEBUG: File saved successfully, size:', buffer.length);

            // DEBUG 6: Prepare media message properly
            const mediaMessage = {
                [mediaType]: buffer,
                mimetype: statusMedia.mimetype || (mediaType === 'image' ? 'image/jpeg' : 'video/mp4'),
                caption: `✅ Status ${mediaType} saved successfully!\n📁 Saved as: ${filename}\n📊 Size: ${formatBytes(buffer.length)}`
            };

            await sock.sendMessage(chatId, mediaMessage);
            await sock.sendMessage(chatId, { react: { text: '☑️', key: message.key } });
            
            console.log('DEBUG: Command completed successfully');

        } catch (downloadError) {
            console.error('DEBUG: Download/save failed:', downloadError);
            await sock.sendMessage(chatId, { 
                text: `❌ Failed to download/save media. Error: ${downloadError.message}\n\nPlease ensure the media is still available.` 
            });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

    } catch (error) {
        console.error('⚠️ Error in saveStatusCommand:', error);
        console.error('Error stack:', error.stack);
        
        // DEBUG 7: More detailed error message
        const errorMessage = error.message || 'Unknown error';
        await sock.sendMessage(chatId, { 
            text: `🉐 Failed to save status.\n\nError: ${errorMessage}\n\nPlease try again or check the logs.` 
        });
    }
}

// Helper function to format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = saveStatusCommand;
