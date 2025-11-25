const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const Jimp = require('jimp');
const webp = require('webp-converter');
const fs = require('fs');

async function blurCommand(sock, chatId, message, quotedMessage) {
    try {
        let imageBuffer;

        // ==== Read Input Image ====
        if (quotedMessage?.imageMessage) {
            const quoted = { message: { imageMessage: quotedMessage.imageMessage } };
            imageBuffer = await downloadMediaMessage(quoted, 'buffer', {}, {});
        } else if (message.message?.imageMessage) {
            imageBuffer = await downloadMediaMessage(message, 'buffer', {}, {});
        } else {
            return sock.sendMessage(chatId, {
                text: '❌ Reply to an image or send an image with caption .blur'
            });
        }

        // ==== Step 1: Save original buffer to temp file ====
        const inputPath = './temp_input.jpg';
        const lowQualityPath = './temp_low.webp';
        const finalPath = './temp_blur.jpg';

        fs.writeFileSync(inputPath, imageBuffer);

        // ==== Step 2: Convert to LOW QUALITY WEBP (fake blur) ====
        await webp.cwebp(inputPath, lowQualityPath, "-q 20", "-v");

        // ==== Step 3: Convert back to JPG ====
        const blurryImage = await Jimp.read(lowQualityPath);
        await blurryImage.quality(70).writeAsync(finalPath);

        const finalBuffer = fs.readFileSync(finalPath);

        // ==== Step 4: Send the blurred image ====
        await sock.sendMessage(chatId, {
            image: finalBuffer,
            caption: '*[ ✔ ] Image Blurred Successfully (WebP method)*'
        });

        // ==== Cleanup ====
        fs.unlinkSync(inputPath);
        fs.unlinkSync(lowQualityPath);
        fs.unlinkSync(finalPath);

    } catch (error) {
        console.error("BLUR ERROR:", error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to blur image.'
        });
    }
}

module.exports = blurCommand;
