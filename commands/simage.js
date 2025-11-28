const fs = require('fs');
const fsPromises = require('fs/promises');
const fse = require('fs-extra');
const path = require('path');
const webp = require('webp-converter');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const tempDir = './temp';

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const scheduleFileDeletion = (filePath) => {
    setTimeout(async () => {
        try {
            if (await fse.pathExists(filePath)) {
                await fse.remove(filePath);
                console.log(`File deleted: ${filePath}`);
            }
        } catch (error) {
            console.error(`Failed to delete file ${filePath}:`, error);
        }
    }, 10000); // 10 seconds
};

const convertStickerToImage = async (sock, quotedMessage, chatId) => {
    let stickerFilePath;
    let outputImagePath;

    try {
        // Check if quoted message exists and has sticker
        if (!quotedMessage || !quotedMessage.stickerMessage) {
            await sock.sendMessage(chatId, { text: 'Reply to a sticker with .simage to convert it.' });
            return;
        }

        const timestamp = Date.now();
        stickerFilePath = path.join(tempDir, `sticker_${timestamp}.webp`);
        outputImagePath = path.join(tempDir, `converted_image_${timestamp}.png`);

        // Download sticker
        const stickerMessage = quotedMessage.stickerMessage;
        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Check if buffer has data
        if (buffer.length === 0) {
            throw new Error('Failed to download sticker: empty buffer');
        }

        await fsPromises.writeFile(stickerFilePath, buffer);

        // Convert WEBP → PNG using webp-converter with promise-based approach
        await new Promise((resolve, reject) => {
            webp.dwebp(stickerFilePath, outputImagePath, "-o", (status, error) => {
                if (error || status !== '0') {
                    reject(new Error(`Conversion failed: ${error || status}`));
                } else {
                    resolve();
                }
            });
        });

        // Check if output file was created
        if (!fs.existsSync(outputImagePath)) {
            throw new Error('Conversion failed: output file not found');
        }

        // Read and send converted image
        const imageBuffer = await fsPromises.readFile(outputImagePath);
        
        await sock.sendMessage(chatId, { 
            image: imageBuffer, 
            caption: 'Here is the converted image!' 
        });

        console.log(`Successfully converted sticker to image for chat ${chatId}`);

    } catch (error) {
        console.error('Error converting sticker to image:', error);
        
        let errorMessage = 'An error occurred while converting the sticker.';
        if (error.message.includes('Conversion failed')) {
            errorMessage = 'Failed to convert the sticker. It might be an animated sticker which is not supported.';
        } else if (error.message.includes('empty buffer')) {
            errorMessage = 'Failed to download the sticker. Please try again.';
        }
        
        await sock.sendMessage(chatId, { text: errorMessage });
    } finally {
        // Clean up temporary files
        if (stickerFilePath) scheduleFileDeletion(stickerFilePath);
        if (outputImagePath) scheduleFileDeletion(outputImagePath);
    }
};

module.exports = convertStickerToImage;
