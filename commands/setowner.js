const fs = require('fs');
const path = require('path');

// Path to store owner settings
const OWNER_FILE = path.join(__dirname, '..', 'data', 'owner.json');
const DEFAULT_OWNER_NAME = 'Not set!';

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize owner file if it doesn't exist
if (!fs.existsSync(OWNER_FILE)) {
    fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: DEFAULT_OWNER_NAME }, null, 2));
}

/**
 * Get the current owner name
 */
function getOwnerName() {
    try {
        const data = JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8'));
        return data.ownerName || DEFAULT_OWNER_NAME;
    } catch (error) {
        console.error('Error reading owner file:', error);
        return DEFAULT_OWNER_NAME;
    }
}

/**
 * Set new owner name with case options
 */
function setOwnerName(newOwnerName, options = {}) {
    try {
        if (!newOwnerName || typeof newOwnerName !== 'string') return false;
        
        const trimmedName = newOwnerName.trim();
        if (trimmedName.length === 0 || trimmedName.length > 20) return false;

        // Apply case formatting
        const finalName = options.upperCase ? trimmedName.toUpperCase() : trimmedName;
        
        fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: finalName }, null, 2));
        return true;
    } catch (error) {
        console.error('Error setting owner name:', error);
        return false;
    }
}

/**
 * Reset owner name to default
 */
function resetOwnerName() {
    try {
        fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: DEFAULT_OWNER_NAME }, null, 2));
        return true;
    } catch (error) {
        console.error('Error resetting owner name:', error);
        return false;
    }
}

/**
 * Validate owner name
 */
function validateOwnerName(name) {
    if (!name || typeof name !== 'string') {
        return { isValid: false, message: 'Owner name cannot be empty!' };
    }
    
    const trimmed = name.trim();
    if (trimmed.length === 0) {
        return { isValid: false, message: 'Owner name cannot be empty!' };
    }
    
    if (trimmed.length > 20) {
        return { isValid: false, message: 'Owner name must be 1-20 characters long!' };
    }
    
    const invalidChars = /[<>@#\$%\^\*\\\/]/;
    if (invalidChars.test(trimmed)) {
        return { isValid: false, message: 'Owner name contains invalid characters!' };
    }
    
    return { isValid: true, message: 'Valid owner name' };
}

// Create fake contact for enhanced replies
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "JUNE-MD-MENU"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE MD\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function handleSetOwnerCommand(sock, chatId, senderId, message, userMessage, currentPrefix) {
    const args = userMessage.split(' ').slice(1);
    const input = args.join(' ').trim(); // Added trim here
    const fake = createFakeContact(message);
    
    // Only bot owner can change owner name
    if (!message.key.fromMe) {
        await sock.sendMessage(chatId, { 
            text: '❌ Only bot owner can change the owner name!'
        }, { quoted: fake });
        return;
    }

    if (!input) {
        const current = getOwnerName();
        await sock.sendMessage(chatId, { 
            text: `👑 Current Owner Name: *${current}*\n\nUsage: ${currentPrefix}setowner <new_name>\nExamples:\n• ${currentPrefix}setowner Supreme\n• ${currentPrefix}setowner supreme\n• ${currentPrefix}setowner SupremeLord\n• ${currentPrefix}setowner UPPER supremelord\n\nTo reset: ${currentPrefix}setowner reset`
        }, { quoted: fake });
        return;
    }

    if (input.toLowerCase() === 'reset') {
        const success = resetOwnerName();
        const response = success ? 
            `✅ Owner name reset to default: *${DEFAULT_OWNER_NAME}*` : 
            '❌ Failed to reset owner name!';
        
        await sock.sendMessage(chatId, { text: response }, { quoted: fake });
        return;
    }

    // Check for uppercase option (case-insensitive)
    let nameToSet = input;
    let useUpperCase = false;
    
    const lowerInput = input.toLowerCase();
    if (lowerInput.startsWith('upper ')) {
        useUpperCase = true;
        nameToSet = input.substring(6).trim(); // Remove "upper " prefix and trim
    }

    const validation = validateOwnerName(nameToSet);
    if (!validation.isValid) {
        await sock.sendMessage(chatId, { text: `❌ ${validation.message}` }, { quoted: fake });
        return;
    }

    const success = setOwnerName(nameToSet, { upperCase: useUpperCase });
    const newName = getOwnerName();
    
    const response = success ? 
        `✅ Owner name successfully set to: *${newName}*${useUpperCase ? ' (UPPERCASE)' : ''}` : 
        '❌ Failed to set owner name!';
    
    await sock.sendMessage(chatId, { text: response }, { quoted: fake });
}

/**
 * Get owner info
 */
function getOwnerInfo() {
    const ownerName = getOwnerName();
    return {
        name: ownerName,
        formattedName: ownerName,
        isDefault: ownerName === DEFAULT_OWNER_NAME
    };
}

/**
 * Check if a given name matches the current owner name
 */
function isOwnerNameMatch(nameToCheck, caseSensitive = true) {
    const currentOwner = getOwnerName();
    return caseSensitive ? 
        currentOwner === nameToCheck : 
        currentOwner.toLowerCase() === nameToCheck.toLowerCase();
}

// Test function to verify the names work
function testOwnerNames() {
    console.log('Testing owner name functionality...');
    
    // Test cases
    const testNames = ['Supreme', 'supreme', 'SupremeLord', 'UPPER supreme'];
    
    testNames.forEach(name => {
        const isUppercase = name.toLowerCase().startsWith('upper ');
        const actualName = isUppercase ? name.substring(6).trim() : name;
        
        const validation = validateOwnerName(actualName);
        console.log(`Name: "${name}" -> Valid: ${validation.isValid}, Message: ${validation.message}`);
        
        if (validation.isValid) {
            const success = setOwnerName(actualName, { upperCase: isUppercase });
            const result = getOwnerName();
            console.log(`Set result: ${success}, Current owner: "${result}"`);
        }
    });
}

// Uncomment to run tests
// testOwnerNames();

module.exports = {
    getOwnerName,
    setOwnerName,
    resetOwnerName,
    handleSetOwnerCommand,
    validateOwnerName,
    getOwnerInfo,
    isOwnerNameMatch,
    DEFAULT_OWNER_NAME,
    testOwnerNames // Export for manual testing
};
