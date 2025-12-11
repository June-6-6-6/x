const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

// ---------- Helpers ----------
function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || stdout || err.message));
            resolve(stdout.toString().trim());
        });
    });
}

async function safeSend(sock, chatId, payload, opts = {}) {
    try { return await sock.sendMessage(chatId, payload, opts); }
    catch { return null; }
}

// ---------- Git Update ----------
async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try { await run('git --version'); return true; }
    catch { return false; }
}

async function updateViaGit() {
    const oldRev = await run('git rev-parse HEAD').catch(() => 'unknown');
    await run('git fetch --all --prune');
    const newRev = await run('git rev-parse origin/main');
    const alreadyUpToDate = oldRev === newRev;

    let commits = '', files = '';
    if (!alreadyUpToDate) {
        commits = await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
        files = await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
        await run(`git reset --hard ${newRev}`);
        await run('git clean -fd');
    }
    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

// ---------- ZIP Update ----------
function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        if (visited.has(url) || visited.size > 5) return reject(new Error('Too many redirects'));
        visited.add(url);

        const client = url.startsWith('https://') ? https : require('http');
        const req = client.get(url, { headers: { 'User-Agent': 'Bot-Updater/1.0' } }, res => {
            if ([301,302,303,307,308].includes(res.statusCode)) {
                const nextUrl = new URL(res.headers.location, url).toString();
                res.resume();
                return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', err => { fs.unlink(dest, () => reject(err)); });
        });
        req.on('error', err => fs.unlink(dest, () => reject(err)));
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        await run(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}' -Force"`);
        return;
    }
    for (const tool of ['unzip', '7z', 'busybox unzip']) {
        try {
            await run(`command -v ${tool.split(' ')[0]}`);
            await run(`${tool} -o '${zipPath}' -d '${outDir}'`);
            return;
        } catch {}
    }
    throw new Error('No unzip tool found (unzip/7z/busybox).');
}

function copyRecursive(src, dest, ignore = [], rel = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry), d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) copyRecursive(s, d, ignore, path.join(rel, entry), outList);
        else {
            fs.mkdirSync(path.dirname(d), { recursive: true });
            fs.copyFileSync(s, d);
            outList.push(path.join(rel, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip() {
    const zipUrl = (settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) throw new Error('No ZIP URL configured.');

    const tmpDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath);

    const extractTo = path.join(tmpDir, 'update_extract');
    fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    let root = extractTo;
    const entries = fs.readdirSync(extractTo);
    if (entries.length === 1) {
        const candidate = path.join(extractTo, entries[0]);
        if (fs.lstatSync(candidate).isDirectory()) root = candidate;
    }

    const ignore = ['node_modules','.git','session','tmp','temp','data','baileys_store.json'];
    const copied = [];
    copyRecursive(root, process.cwd(), ignore, '', copied);

    fs.rmSync(extractTo, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });
    return { copiedFiles: copied };
}

// ---------- Restart ----------
async function restartProcess(sock, chatId, message) {
    await safeSend(sock, chatId, { text: '✅ Update complete! Restarting…' }, { quoted: message });
    try { await run('pm2 restart all'); }
    catch { setTimeout(() => process.exit(0), 500); }
}

// ---------- Main Command ----------
async function updateCommand(sock, chatId, message = {}, zipOverride) {
    const senderId = message.key?.participant || message.key?.remoteJid || settings.ownerNumber;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    if (!message.key?.fromMe && !isOwner) {
        return safeSend(sock, chatId, { text: 'Only bot owner or sudo can use .update' }, { quoted: message });
    }

    let status = await safeSend(sock, chatId, { text: '🔄 Updating bot, please wait…' }, { quoted: message });

    try {
        if (await hasGitRepo()) {
            status && await safeSend(sock, chatId, { text: '🔄 Updating via Git…', edit: status.key });
            const { oldRev, newRev, alreadyUpToDate } = await updateViaGit();
            const summary = alreadyUpToDate ? `✅ Already up to date: ${newRev}` : `✅ Updated ${oldRev.slice(0,7)} → ${newRev.slice(0,7)}`;
            await safeSend(sock, chatId, { text: `${summary}\n📦 Installing dependencies...`, edit: status.key });
        } else {
            status && await safeSend(sock, chatId, { text: '📥 Downloading update via ZIP…', edit: status.key });
            const { copiedFiles } = await updateViaZip(zipOverride);
            await safeSend(sock, chatId, { text: `✅ Extracted ${copiedFiles.length} files\n📦 Installing dependencies...`, edit: status.key });
        }

        await run('npm install --no-audit --no-fund');
        await safeSend(sock, chatId, { text: '✅ Update completed! Restarting bot...', edit: status.key });
        await restartProcess(sock, chatId, message);
    } catch (err) {
        console.error('Update failed:', err);
        const msg = `❌ Update failed:\n${String(err.message || err).slice(0,1000)}`;
        status ? await safeSend(sock, chatId, { text: msg, edit: status.key }) : await safeSend(sock, chatId, { text: msg }, { quoted: message });
    }
}

// ---------- Auto Update Scheduler ----------
function scheduleAutoUpdate(sock) {
    const interval = 48 * 60 * 60 * 1000; // 48 hours
    setInterval(async () => {
        const chatId = settings.ownerNumber + '@s.whatsapp.net';
        await safeSend(sock, chatId, { text: '⏰ Auto-update triggered after 48hrs…' });
        await updateCommand(sock, chatId, { key: { fromMe: true } });
    }, interval);
}

module.exports = { updateCommand, scheduleAutoUpdate };
