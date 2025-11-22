const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try {
        await run('git --version');
        return true;
    } catch {
        return false;
    }
}

async function updateViaGit() {
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run('git fetch --all --prune');
    const newRev = (await run('git rev-parse origin/main')).trim();
    const alreadyUpToDate = oldRev === newRev;
    const commits = alreadyUpToDate ? '' : await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    const files = alreadyUpToDate ? '' : await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
    await run(`git reset --hard ${newRev}`);
    await run('git clean -fd');
    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            // Avoid infinite redirect loops
            if (visited.has(url) || visited.size > 5) {
                return reject(new Error('Too many redirects'));
            }
            visited.add(url);

            const useHttps = url.startsWith('https://');
            const client = useHttps ? https : require('http');
            const req = client.get(url, {
                headers: {
                    'User-Agent': 'KnightBot-Updater/1.0',
                    'Accept': '*/*'
                }
            }, res => {
                // Handle redirects
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                    const nextUrl = new URL(location, url).toString();
                    res.resume();
                    return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }

                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', err => {
                    try { file.close(() => {}); } catch {}
                    fs.unlink(dest, () => reject(err));
                });
            });
            req.on('error', err => {
                fs.unlink(dest, () => reject(err));
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function extractZip(zipPath, outDir) {
    // Try to use platform tools; no extra npm modules required
    if (process.platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/\\/g, '/').replace(/'/g, "''")}' -Force"`;
        await run(cmd);
        return;
    }
    // Linux/mac: try unzip, else 7z, else busybox unzip
    try {
        await run('command -v unzip');
        await run(`unzip -o '${zipPath.replace(/'/g, "'\\''")}' -d '${outDir.replace(/'/g, "'\\''")}'`);
        return;
    } catch {}
    try {
        await run('command -v 7z');
        await run(`7z x -y '${zipPath.replace(/'/g, "'\\''")}' -o'${outDir.replace(/'/g, "'\\''")}'`);
        return;
    } catch {}
    try {
        await run('busybox unzip -h');
        await run(`busybox unzip -o '${zipPath.replace(/'/g, "'\\''")}' -d '${outDir.replace(/'/g, "'\\''")}'`);
        return;
    } catch {}
    throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode is recommended on this panel.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            // Ensure destination directory exists before copying
            const destDir = path.dirname(d);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(s, d);
            if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip(sock, chatId, message, zipOverride) {
    const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) {
        throw new Error('No ZIP URL configured. Set settings.updateZipUrl or UPDATE_ZIP_URL env.');
    }
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath);
    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    // Find the top-level extracted folder (GitHub zips create REPO-branch folder)
    const entries = fs.readdirSync(extractTo);
    let root = extractTo;
    if (entries.length === 1) {
        const potentialRoot = path.join(extractTo, entries[0]);
        if (fs.existsSync(potentialRoot) && fs.lstatSync(potentialRoot).isDirectory()) {
            root = potentialRoot;
        }
    }

    const srcRoot = root;

    // Copy over while preserving runtime dirs/files
    const ignore = ['node_modules', '.git', 'session', 'tmp', 'tmp/', 'temp', 'data', 'baileys_store.json'];
    const copied = [];
    
    // Preserve ownerNumber from existing settings.js if present
    let preservedOwner = null;
    let preservedBotOwner = null;
    try {
        // Clear require cache to get fresh settings
        delete require.cache[require.resolve('../settings')];
        const currentSettings = require('../settings');
        preservedOwner = currentSettings && currentSettings.ownerNumber ? String(currentSettings.ownerNumber) : null;
        preservedBotOwner = currentSettings && currentSettings.botOwner ? String(currentSettings.botOwner) : null;
    } catch (e) {
        console.log('Could not preserve settings:', e.message);
    }
    
    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);
    
    if (preservedOwner) {
        try {
            const settingsPath = path.join(process.cwd(), 'settings.js');
            if (fs.existsSync(settingsPath)) {
                let text = fs.readFileSync(settingsPath, 'utf8');
                text = text.replace(/ownerNumber:\s*'[^']*'/, `ownerNumber: '${preservedOwner}'`);
                if (preservedBotOwner) {
                    text = text.replace(/botOwner:\s*'[^']*'/, `botOwner: '${preservedBotOwner}'`);
                }
                fs.writeFileSync(settingsPath, text);
            }
        } catch (e) {
            console.log('Could not update settings file:', e.message);
        }
    }
    
    // Cleanup extracted directory
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    return { copiedFiles: copied };
}

async function restartProcess(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '✅ Update complete! Restarting…' }, { quoted: message });
    } catch {}
    try {
        // Preferred: PM2
        await run('pm2 restart all');
        return;
    } catch {}
    // Panels usually auto-restart when the process exits.
    // Exit after a short delay to allow the above message to flush.
    setTimeout(() => {
        process.exit(0);
    }, 500);
}

async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, { text: 'Only bot owner or sudo can use .update' }, { quoted: message });
        return;
    }

    let statusMessage = null;
    
    try {
        // Send initial message and store it for editing
        statusMessage = await sock.sendMessage(chatId, { text: '🔄 Updating the bot, please wait…' }, { quoted: message });
        
        if (await hasGitRepo()) {
            // Update status message
            if (statusMessage && statusMessage.key) {
                await sock.sendMessage(chatId, { 
                    text: '🔄 Updating via Git...',
                    edit: statusMessage.key
                });
            }
            
            const { oldRev, newRev, alreadyUpToDate, commits, files } = await updateViaGit();
            
            // Update status message with git result
            if (statusMessage && statusMessage.key) {
                const summary = alreadyUpToDate ? 
                    `✅ Already up to date: ${newRev}` : 
                    `✅ Updated from ${oldRev.substring(0, 7)} to ${newRev.substring(0, 7)}`;
                
                await sock.sendMessage(chatId, { 
                    text: `${summary}\n📦 Installing dependencies...`,
                    edit: statusMessage.key
                });
            }
            
            await run('npm install --no-audit --no-fund');
        } else {
            // Update status message for ZIP update
            if (statusMessage && statusMessage.key) {
                await sock.sendMessage(chatId, { 
                    text: '📥 Downloading update via ZIP...',
                    edit: statusMessage.key
                });
            }
            
            const { copiedFiles } = await updateViaZip(sock, chatId, message, zipOverride);
            
            // Update status message after ZIP extraction
            if (statusMessage && statusMessage.key) {
                await sock.sendMessage(chatId, { 
                    text: `✅ Extracted ${copiedFiles.length} files\n📦 Installing dependencies...`,
                    edit: statusMessage.key
                });
            }
            
            // Install dependencies for ZIP update too
            await run('npm install --no-audit --no-fund');
        }
        
        // Final update before restart
        if (statusMessage && statusMessage.key) {
            await sock.sendMessage(chatId, { 
                text: '✅ Update completed! Restarting bot...',
                edit: statusMessage.key
            });
        }
        
        await restartProcess(sock, chatId, message);
    } catch (err) {
        console.error('Update failed:', err);
        
        // Edit the original status message with error
        if (statusMessage && statusMessage.key) {
            await sock.sendMessage(chatId, { 
                text: `❌ Update failed:\n${String(err.message || err).substring(0, 1000)}`,
                edit: statusMessage.key
            });
        } else {
            // Fallback to new message if editing failed
            await sock.sendMessage(chatId, { 
                text: `❌ Update failed:\n${String(err.message || err).substring(0, 1000)}`
            }, { quoted: message });
        }
    }
}

module.exports = updateCommand;
