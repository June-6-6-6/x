const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

// -------------------- Utility --------------------
function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || stdout || err.message));
            resolve(stdout.toString().trim());
        });
    });
}

function sendStatus(sock, chatId, statusMessageKey, text, react, quoted) {
    if (!sock || !chatId) return;
    if (text) sock.sendMessage(chatId, { text, edit: statusMessageKey }, quoted ? { quoted } : {});
    if (react) sock.sendMessage(chatId, { react: { text: react, key: quoted?.key } });
}

// -------------------- Git Update --------------------
async function hasGitRepo() {
    return fs.existsSync(path.join(process.cwd(), '.git')) &&
        await run('git --version').then(() => true).catch(() => false);
}

async function updateViaGit() {
    const oldRev = await run('git rev-parse HEAD').catch(() => 'unknown');
    await run('git fetch --all --prune');
    const newRev = await run('git rev-parse origin/main');
    const alreadyUpToDate = oldRev === newRev;

    if (!alreadyUpToDate) {
        await run(`git reset --hard ${newRev}`);
        await run('git clean -fd');
    }
    return { oldRev, newRev, alreadyUpToDate };
}

// -------------------- ZIP Update --------------------
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https://') ? https : require('http');
        const req = client.get(url, { headers: { 'User-Agent': 'Bot-Updater/1.0' } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', reject);
        });
        req.on('error', reject);
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        await run(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}' -Force"`);
    } else {
        try { await run(`unzip -o '${zipPath}' -d '${outDir}'`); }
        catch { await run(`7z x -y '${zipPath}' -o'${outDir}'`).catch(() => { throw new Error("No unzip tool found"); }); }
    }
}

function copyRecursive(src, dest, ignore = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) copyRecursive(s, d, ignore);
        else {
            fs.mkdirSync(path.dirname(d), { recursive: true });
            fs.copyFileSync(s, d);
        }
    }
}

async function updateViaZip(zipUrl) {
    const tmpDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');

    await downloadFile(zipUrl, zipPath);

    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    const entries = fs.readdirSync(extractTo);
    const root = entries.length === 1 ? path.join(extractTo, entries[0]) : extractTo;

    copyRecursive(root, process.cwd(), ['node_modules', '.git', 'session', 'tmp', 'data']);
    fs.rmSync(extractTo, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });
}

// -------------------- Restart --------------------
async function restartProcess(sock, chatId, message) {
    try {
        await run('pm2 restart all');
        sendStatus(sock, chatId, null, '🔄 Restarting bot process... Please wait.', null, message);
    } catch {
        setTimeout(() => process.exit(0), 500);
    }
}

// -------------------- Update Command --------------------
async function updateCommand(sock, chatId, message, zipOverride) {
    let statusMessageKey = null;

    try {
        if (sock && chatId) {
            const initialMessage = await sock.sendMessage(chatId, { text: '↕️ Downloading Update ....' }, { quoted: message });
            statusMessageKey = initialMessage.key;
            sendStatus(sock, chatId, null, null, '⏳', message);
        }

        if (await hasGitRepo()) {
            const { oldRev, newRev, alreadyUpToDate } = await updateViaGit();

            if (alreadyUpToDate) {
                sendStatus(sock, chatId, statusMessageKey, '✅ No changes detected. Bot is already up to date.', '👌', message);
                return;
            }

            sendStatus(sock, chatId, statusMessageKey, `↕️ Downloading Update ....\nRevision: ${oldRev} → ${newRev}`);

        } else {
            const zipUrl = zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL;
            if (!zipUrl) throw new Error('⚠️ No ZIP update URL configured.');
            await updateViaZip(zipUrl);
        }

        sendStatus(sock, chatId, statusMessageKey, '⬇️ Installing dependencies....');
        await run('npm install --no-audit --no-fund');

        sendStatus(sock, chatId, statusMessageKey, '✅ Update done', '✅', message);
        await restartProcess(sock, chatId, message);

    } catch (err) {
        console.error('Update failed:', err.message);
        sendStatus(sock, chatId, statusMessageKey, `❌ Update failed.\nReason: ${err.message}`, '❌', message);
    }
}

// 🔄 Auto-update every 24h 30m
setInterval(() => {
    console.log('⏰ Scheduled auto-update triggered...');
    updateCommand(null, null, null, null);
}, (24 * 60 * 60 * 1000) + (30 * 60 * 1000));

module.exports = updateCommand;
