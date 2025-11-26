const fs = require('fs');
const path = require('path');

// Paths & Defaults
const DATA_DIR = path.join(__dirname, '..', 'data');
const OWNER_FILE = path.join(DATA_DIR, 'owner.json');
const DEFAULT_OWNER_NAME = 'Not set !';

// Ensure data directory & file exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(OWNER_FILE)) saveOwner(DEFAULT_OWNER_NAME);

// --- Utility Functions ---

function readOwnerFile() {
    try {
        return JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8'));
    } catch {
        return { ownerName: DEFAULT_OWNER_NAME };
    }
}

function saveOwner(name) {
    fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: name }, null, 2));
}

// --- Core Functions ---

function getOwnerName() {
    return readOwnerFile().ownerName || DEFAULT_OWNER_NAME;
}

function setOwnerName(newName) {
    const validation = validateOwnerName(newName);
    if (!validation.isValid) return { success: false, message: validation.message };

    saveOwner(newName.trim());
    return { success: true, message: `Owner name set to: ${newName.trim()}` };
}

function resetOwnerName() {
    saveOwner(DEFAULT_OWNER_NAME);
    return { success: true, message: `Owner name reset to default: ${DEFAULT_OWNER_NAME}` };
}

function validateOwnerName(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        return { isValid: false, message: 'Owner name cannot be empty!' };
    }
    if (name.trim().length > 20) {
        return { isValid: false, message: 'Owner name must be 1-20 characters long!' };
    }
    if (/[<>@#\$%\^\*\\\/]/.test(name)) {
        return { isValid: false, message: 'Owner name contains invalid characters!' };
    }
    return { isValid: true, message: 'Valid owner name' };
}

function getOwnerInfo() {
    const name = getOwnerName();
    return {
        name,
        formattedName: name,
        isDefault: name === DEFAULT_OWNER_NAME
    };
}

function isOwnerNameMatch(name) {
    return getOwnerName() === name;
}

function isOwnerNameMatchCaseInsensitive(name) {
    return getOwnerName().toLowerCase() === name.toLowerCase();
}

// --- WhatsApp Command Handler ---

async function handleSetOwnerCommand(sock, chatId, message, userMessage, prefix) {
    const args = userMessage.split(' ').slice(1);
    const newName = args.join(' ');

    const fakeContact = createFakeContact(message);

    if (!message.key.fromMe) {
        return sock.sendMessage(chatId, { text: '❌ Only bot owner can change the owner name!' }, { quoted: fakeContact });
    }

    if (!newName) {
        return sock.sendMessage(chatId, { 
            text: `👑 Current Owner Name: *${getOwnerName()}*\n\nUsage: ${prefix}setowner <new_name>\nExample: ${prefix}setowner Supreme\nExample: ${prefix}setowner John Doe\n\nTo reset: ${prefix}setowner reset\n\n📝 Note: Case is preserved.`
        }, { quoted: fakeContact });
    }

    if (newName.toLowerCase() === 'reset') {
        const result = resetOwnerName();
        return sock.sendMessage(chatId, { text: `✅ ${result.message}` }, { quoted: fakeContact });
    }

    const result = setOwnerName(newName);
    return sock.sendMessage(chatId, { 
        text: result.success ? `✅ ${result.message}` : `❌ ${result.message}` 
    }, { quoted: fakeContact });
}

// --- Fake Contact Generator ---
function createFakeContact(message) {
    const id = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
    return {
        key: { participants: "0@s.whatsapp.net", remoteJid: "status@broadcast", fromMe: false, id: "JUNE-MD-MENU" },
        message: { contactMessage: { vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE MD\nitem1.TEL;waid=${id}:${id}\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } },
        participant: "0@s.whatsapp.net"
    };
}

// --- Exports ---
module.exports = {
    getOwnerName,
    setOwnerName,
    resetOwnerName,
    handleSetOwnerCommand,
    validateOwnerName,
    getOwnerInfo,
    isOwnerNameMatch,
    isOwnerNameMatchCaseInsensitive,
    DEFAULT_OWNER_NAME
};
