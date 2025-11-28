const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');
const { exec } = require('child_process');
const settings = require('../settings');

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Run ffmpeg command to convert sticker to webp
 */
function runFFmpeg(input, output, isAnimated) {
    const command = isAnimated
        ? `ffmpeg -i "${input}" -vf "scale=512:-1:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -lossless 0 -q:v 60 "${output}"`
        : `ffmpeg -i "${input}" -vf "scale=512:-1:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -vcodec libwebp -lossless 0 -q:v 75 "${output}"`;

    return new Promise((resolve, reject) => {
        exec(command, err => (err ? reject(err) : resolve()));
    });
}

/**
 * Add EXIF metadata to webp image
 */
async function addExif(webpBuffer, pushname, emoji) {
    const img = new webp.Image();
    await img.load(webpBuffer);

    const metadata = {
        "sticker-pack-id": crypto.randomBytes(32).toString("hex"),
        "sticker-pack-name": pushname,
        "emojis": emoji ? [emoji] : ["🤖"]
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);

    const jsonBuffer = Buffer.from(JSON.stringify(metadata), "utf8");
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    img.exif = exif;
    return img.save(null);
}

/**
 * Main command handler
 */
async function stickerTelegramCommand(sock, chatId, msg) {
    try {
        const pushname = msg.pushName || "Unknown User";
        const text = msg.message?.conversation?.trim() ||
                     msg.message?.extendedTextMessage?.text?.trim() || '';
        const args = text.split(' ').slice(1);

        if (!args[0]) {
            return sock.sendMessage(chatId, { 
                text: '⚠️ Please enter the Telegram sticker URL!\nExample:\n.tg https://t.me/addstickers/Porcientoreal'
            });
        }

        if (!args[0].match(/^https:\/\/t\.me\/addstickers\//i)) {
            return sock.sendMessage(chatId, { 
                text: '❌ Invalid URL!\nUse a valid Telegram sticker pack link.'
            });
        }

        const packName = args[0].replace("https://t.me/addstickers/", "");
        const botToken = settings.telegram_token;

        // Fetch sticker pack metadata
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(packName)}`);
        const stickerSet = await response.json();

        if (!stickerSet.ok) throw new Error("Invalid Telegram sticker pack");

        await sock.sendMessage(chatId, { 
            text: `📦 Found ${stickerSet.result.stickers.length} stickers\n⏳ Starting download...`
        });

        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        let successCount = 0;

        for (const [i, sticker] of stickerSet.result.stickers.entries()) {
            try {
                // Get file info
                const fileInfo = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${sticker.file_id}`);
                const fileData = await fileInfo.json();
                if (!fileData.ok) continue;

                const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
                const imageBuffer = await (await fetch(fileUrl)).buffer();

                const tempInput = path.join(tmpDir, `input_${Date.now()}_${i}`);
                const tempOutput = path.join(tmpDir, `sticker_${Date.now()}_${i}.webp`);
                fs.writeFileSync(tempInput, imageBuffer);

                await runFFmpeg(tempInput, tempOutput, sticker.is_animated || sticker.is_video);

                const webpBuffer = fs.readFileSync(tempOutput);
                const finalBuffer = await addExif(webpBuffer, pushname, sticker.emoji);

                await sock.sendMessage(chatId, { sticker: finalBuffer });
                successCount++;

                await delay(800);
                fs.unlinkSync(tempInput);
                fs.unlinkSync(tempOutput);

            } catch (err) {
                console.error(`❌ Error on sticker ${i}`, err);
            }
        }

        await sock.sendMessage(chatId, { 
            text: `✅ Successfully downloaded ${successCount}/${stickerSet.result.stickers.length} stickers!`
        });

    } catch (error) {
        console.error('❌ stickerTelegramCommand Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to process Telegram stickers.\nCheck the link and try again.' 
        });
    }
}

module.exports = stickerTelegramCommand;
