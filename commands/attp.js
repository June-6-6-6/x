const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { writeExifVid } = require('../lib/exif');

class ATTPRenderer {
    constructor() {
        this.fontPath = this.getFontPath();
        this.maxTextLength = 100; // Prevent excessively long text
        this.videoDuration = 1.8;
        this.frameRate = 20;
        this.canvasSize = '512x512';
    }

    getFontPath() {
        if (process.platform === 'win32') {
            return 'C:/Windows/Fonts/arialbd.ttf';
        } else {
            // Try multiple possible font paths for better cross-platform support
            const possiblePaths = [
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
                '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
                '/System/Library/Fonts/Arial.ttf' // macOS
            ];
            
            for (const fontPath of possiblePaths) {
                if (fs.existsSync(fontPath)) {
                    return fontPath;
                }
            }
            return possiblePaths[0]; // Fallback to first option
        }
    }

    escapeDrawtextText(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/:/g, '\\:')
            .replace(/,/g, '\\,')
            .replace(/'/g, "\\'")
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/%/g, '\\%')
            .replace(/\n/g, ' '); // Remove newlines
    }

    validateText(text) {
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }
        
        if (text.length > this.maxTextLength) {
            throw new Error(`Text too long. Maximum ${this.maxTextLength} characters allowed.`);
        }

        // Basic safety check for command injection
        if (text.includes('`') || text.includes('$') || text.includes('|')) {
            throw new Error('Invalid characters in text');
        }
    }

    async executeFFmpeg(args, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const ff = spawn('ffmpeg', args);
            const chunks = [];
            const errors = [];
            
            let timeoutId = setTimeout(() => {
                ff.kill('SIGTERM');
                reject(new Error('FFmpeg execution timeout'));
            }, timeout);

            ff.stdout.on('data', (d) => chunks.push(d));
            ff.stderr.on('data', (e) => errors.push(e));
            
            ff.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
            
            ff.on('close', (code) => {
                clearTimeout(timeoutId);
                if (code === 0) {
                    resolve(Buffer.concat(chunks));
                } else {
                    const errorOutput = Buffer.concat(errors).toString();
                    reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`));
                }
            });
        });
    }

    async renderBlinkingVideo(text) {
        this.validateText(text);
        const safeText = this.escapeDrawtextText(text);
        const safeFontPath = process.platform === 'win32' 
            ? this.fontPath.replace(/\\/g, '/').replace(':', '\\:')
            : this.fontPath;

        const cycle = 0.3; // Blink cycle length in seconds
        const colors = [
            { color: 'red', condition: `lt(mod(t\\,${cycle})\\,0.1)` },
            { color: 'blue', condition: `between(mod(t\\,${cycle})\\,0.1\\,0.2)` },
            { color: 'green', condition: `gte(mod(t\\,${cycle})\\,0.2)` }
        ];

        const drawFilters = colors.map(({ color, condition }) => 
            `drawtext=fontfile='${safeFontPath}':text='${safeText}':` +
            `fontcolor=${color}:borderw=2:bordercolor=black@0.6:` +
            `fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2:enable='${condition}'`
        ).join(',');

        const args = [
            '-y',
            '-f', 'lavfi',
            '-i', `color=c=black:s=${this.canvasSize}:d=${this.videoDuration}:r=${this.frameRate}`,
            '-vf', drawFilters,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart+frag_keyframe+empty_moov',
            '-t', String(this.videoDuration),
            '-f', 'mp4',
            'pipe:1'
        ];

        return await this.executeFFmpeg(args);
    }

    async cleanupTempFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.warn('Failed to cleanup temp file:', filePath, error.message);
        }
    }
}

async function attpCommand(sock, chatId, message) {
    const renderer = new ATTPRenderer();
    
    try {
        // Extract text from different message types
        const userMessage = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || 
                           message.message?.imageMessage?.caption ||
                           '';
        
        const text = userMessage.split(' ').slice(1).join(' ').trim();

        if (!text) {
            await sock.sendMessage(chatId, { 
                text: 'Please provide text after the .attp command.\nExample: .attp Hello World' 
            }, { quoted: message });
            return;
        }

        // Send initial processing message
        const processingMsg = await sock.sendMessage(chatId, { 
            text: '🔄 Creating blinking text sticker...' 
        }, { quoted: message });

        const mp4Buffer = await renderer.renderBlinkingVideo(text);
        const webpPath = await writeExifVid(mp4Buffer, { 
            packname: 'Knight Bot',
            author: 'ATTP Generator'
        });
        
        const webpBuffer = fs.readFileSync(webpPath);
        
        // Cleanup temp file
        await renderer.cleanupTempFile(webpPath);
        
        // Delete processing message and send sticker
        if (processingMsg.key) {
            await sock.sendMessage(chatId, {
                delete: processingMsg.key
            });
        }
        
        await sock.sendMessage(chatId, { 
            sticker: webpBuffer 
        }, { quoted: message });

    } catch (error) {
        console.error('Error generating ATTP sticker:', error);
        
        let errorMessage = 'Failed to generate the sticker. ';
        
        if (error.message.includes('Text too long')) {
            errorMessage = error.message;
        } else if (error.message.includes('FFmpeg failed')) {
            errorMessage += 'FFmpeg processing error.';
        } else if (error.message.includes('timeout')) {
            errorMessage += 'Processing took too long.';
        } else if (error.message.includes('Invalid characters')) {
            errorMessage = error.message;
        } else if (error.message.includes('Text cannot be empty')) {
            errorMessage = 'Please provide some text for the sticker.';
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

// Export for testing
module.exports = { attpCommand, ATTPRenderer };
