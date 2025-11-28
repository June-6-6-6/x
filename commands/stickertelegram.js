const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');
const { exec } = require('child_process');
const settings = require('../settings');

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Execute ffmpeg to convert input to webp sticker.
 */
function runFFmpeg(inputPath, outputPath, isAnimated) {
  const command = isAnimated
    ? `ffmpeg -y -i "${inputPath}" -vf "scale=512:-1:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -lossless 0 -q:v 60 "${outputPath}"`
    : `ffmpeg -y -i "${inputPath}" -vf "scale=512:-1:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -vcodec libwebp -lossless 0 -q:v 75 "${outputPath}"`;

  return new Promise((resolve, reject) => {
    exec(command, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Inject EXIF metadata for WhatsApp sticker packs.
 */
async function addExif(webpBuffer, packName, emoji) {
  const img = new webp.Image();
  await img.load(webpBuffer);

  const metadata = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': packName,
    'emojis': emoji ? [emoji] : ['🤖'],
  };

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);

  const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);

  img.exif = exif;
  return img.save(null);
}

/**
 * Main command: download a Telegram sticker pack and send as WhatsApp stickers.
 */
async function stickerTelegramCommand(sock, chatId, msg) {
  try {
    const pushname = msg.pushName || 'Unknown User';
    const text = (
      msg.message?.conversation?.trim() ||
      msg.message?.extendedTextMessage?.text?.trim() ||
      ''
    );

    const args = text.split(' ').slice(1); // e.g., ".tg <url>"
    const url = args[0];

    // Validate URL presence
    if (!url) {
      return sock.sendMessage(chatId, {
        text: '⚠️ Please enter the Telegram sticker URL!\nExample:\n.tg https://t.me/addstickers/Porcientoreal',
      });
    }

    // Validate URL format
    if (!/^https:\/\/t\.me\/addstickers\/[A-Za-z0-9_]+$/i.test(url)) {
      return sock.sendMessage(chatId, {
        text: '❌ Invalid URL!\nUse a valid Telegram sticker pack link like:\nhttps://t.me/addstickers/<packname>',
      });
    }

    // Config: Telegram bot token
    const botToken = settings.telegram_token;
    if (!botToken) {
      return sock.sendMessage(chatId, {
        text: '❌ Telegram bot token is not configured. Please set settings.telegram_token.',
      });
    }

    const packName = url.replace('https://t.me/addstickers/', '');

    // Fetch sticker pack metadata
    const metaRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(packName)}`
    );
    const stickerSet = await metaRes.json();

    if (!stickerSet.ok || !stickerSet.result?.stickers?.length) {
      return sock.sendMessage(chatId, {
        text: '❌ Could not fetch this sticker pack. Check the link or try another pack.',
      });
    }

    await sock.sendMessage(chatId, {
      text: `📦 Found ${stickerSet.result.stickers.length} stickers\n⏳ Starting download...`,
    });

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    let successCount = 0;

    for (const [i, sticker] of stickerSet.result.stickers.entries()) {
      const stamp = Date.now();

      try {
        // Get file info
        const fileInfoRes = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${sticker.file_id}`
        );
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) continue;

        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
        const imageBuffer = await (await fetch(fileUrl)).buffer();

        // Temp file paths
        const tempInput = path.join(tmpDir, `tg_input_${stamp}_${i}`);
        const tempOutput = path.join(tmpDir, `tg_sticker_${stamp}_${i}.webp`);

        fs.writeFileSync(tempInput, imageBuffer);

        // Convert via ffmpeg
        const isAnimated = Boolean(sticker.is_animated || sticker.is_video);
        await runFFmpeg(tempInput, tempOutput, isAnimated);

        // Read webp, add EXIF
        const webpBuffer = fs.readFileSync(tempOutput);
        const finalBuffer = await addExif(webpBuffer, pushname, sticker.emoji);

        // Send sticker
        await sock.sendMessage(chatId, { sticker: finalBuffer });
        successCount++;

        // Be gentle to rate limits
        await delay(800);

        // Cleanup
        try { fs.unlinkSync(tempInput); } catch {}
        try { fs.unlinkSync(tempOutput); } catch {}

      } catch (err) {
        console.error(`❌ Error on sticker ${i}:`, err);
        // Attempt cleanup even on error
        try { fs.unlinkSync(path.join(tmpDir, `tg_input_${stamp}_${i}`)); } catch {}
        try { fs.unlinkSync(path.join(tmpDir, `tg_sticker_${stamp}_${i}.webp`)); } catch {}
        continue;
      }
    }

    await sock.sendMessage(chatId, {
      text: `✅ Successfully downloaded ${successCount}/${stickerSet.result.stickers.length} stickers!`,
    });

  } catch (error) {
    console.error('❌ stickerTelegramCommand Error:', error);
    await sock.sendMessage(chatId, {
      text: '❌ Failed to process Telegram stickers.\nCheck the link and try again.',
    });
  }
}

module.exports = stickerTelegramCommand;
