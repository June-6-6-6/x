const fs = require('fs');
const path = require('path');

// Path to store owner settings
const OWNER_FILE = path.join(__dirname, '..', 'data', 'owner.json');

// Default owner name
const DEFAULT_OWNER_NAME = 'Not set !';

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
 * @returns {string} The current owner name
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
 * Set new owner name with case sensitivity
 * @param {string} newOwnerName - The new owner name to set
 * @returns {boolean} Success status
 */
function setOwnerName(newOwnerName) {
    try {
        // Validate owner name - allow mixed case
        if (!newOwnerName || typeof newOwnerName !== 'string' || newOwnerName.trim().length === 0 || newOwnerName.length > 20) {
            return false;
        }
        
        // Trim and preserve original case
        const trimmedName = newOwnerName.trim();
        
        const data = { ownerName: trimmedName };
        fs.writeFileSync(OWNER_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error setting owner name:', error);
        return false;
    }
}

/**
 * Reset owner name to default
 * @returns {boolean} Success status
 */
function resetOwnerName() {
    try {
        const data = { ownerName: DEFAULT_OWNER_NAME };
        fs.writeFileSync(OWNER_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error resetting owner name:', error);
        return false;
    }
}

/**
 * Format owner name display with proper case handling
 * @param {string} name - The owner name to format
 * @returns {string} Formatted name
 */
function formatOwnerName(name) {
    if (!name || name === DEFAULT_OWNER_NAME) {
        return name;
    }
    
    // Return the name as stored (preserving original case)
    return name;
}

/**
 * Validate owner name with case sensitivity
 * @param {string} name - The name to validate
 * @returns {Object} Validation result { isValid: boolean, message: string }
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
    
    // Check for invalid characters (optional - you can customize this)
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
    const newOwnerName = args.join(' ');
    
    const fake = createFakeContact(message);
    
    // Only bot owner can change owner name
    if (!message.key.fromMe) {
        await sock.sendMessage(chatId, { 
            text: '❌ Only bot owner can change the owner name!',
            contextInfo: {
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '',
                    newsletterName: '',
                    serverMessageId: -1
                }
            }
        }, { quoted: fake });
        return;
    }

    if (!newOwnerName) {
        // Show current owner name with preserved case
        const current = getOwnerName();
        const formattedCurrent = formatOwnerName(current);
        
        await sock.sendMessage(chatId, { 
            text: `👑 Current Owner Name: *${formattedCurrent}*\n\nUsage: ${currentPrefix}setowner <new_name>\nExample: ${currentPrefix}setowner Supreme\nExample: ${currentPrefix}setowner john doe\nExample: ${currentPrefix}setowner JANE Doe\n\nTo reset: ${currentPrefix}setowner reset\n\n📝 Note: Owner name preserves letter case (uppercase/lowercase)`,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '',
                    newsletterName: '',
                    serverMessageId: -1
                }
            }
        }, { quoted: fake });
        return;
    }

    if (newOwnerName.toLowerCase() === 'reset') {
        // Reset to default owner name
        const success = resetOwnerName();
        if (success) {
            const defaultOwnerName = getOwnerName();
            await sock.sendMessage(chatId, { 
                text: `✅ Owner name reset to default: *${defaultOwnerName}*`,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: false,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '@',
                        newsletterName: '',
                        serverMessageId: -1
                    }
                }
            }, { quoted: fake });
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to reset owner name!',
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: false,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '@',
                        newsletterName: '',
                        serverMessageId: -1
                    }
                }
            }, { quoted: fake });
        }
        return;
    }

    // Validate the new owner name
    const validation = validateOwnerName(newOwnerName);
    if (!validation.isValid) {
        await sock.sendMessage(chatId, { 
            text: `❌ ${validation.message}`,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '',
                    newsletterName: '',
                    serverMessageId: -1
                }
            }
        }, { quoted: fake });
        return;
    }

    // Set new owner name with preserved case
    const success = setOwnerName(newOwnerName);
    if (success) {
        const formattedNewName = formatOwnerName(newOwnerName);
        await sock.sendMessage(chatId, { 
            text: `✅ Owner name successfully set to: *${formattedNewName}*`,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '@',
                    newsletterName: '',
                    serverMessageId: -1
                }
            }
        }, { quoted: fake });
    } else {
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to set owner name!',
            contextInfo: {
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '@',
                    newsletterName: '',
                    serverMessageId: -1
                }
            }
        }, { quoted: fake });
    }
}

/**
 * Get owner info with formatted display
 * @returns {Object} Owner information
 */
function getOwnerInfo() {
    const ownerName = getOwnerName();
    return {
        name: ownerName,
        formattedName: formatOwnerName(ownerName),
        isDefault: ownerName === DEFAULT_OWNER_NAME
    };
}

/**
 * Check if a given name matches the current owner name (case-sensitive)
 * @param {string} nameToCheck - The name to check
 * @returns {boolean} True if matches (case-sensitive)
 */
function isOwnerNameMatch(nameToCheck) {
    const currentOwner = getOwnerName();
    return currentOwner === nameToCheck;
}

/**
 * Check if a given name matches the current owner name (case-insensitive)
 * @param {string} nameToCheck - The name to check
 * @returns {boolean} True if matches (case-insensitive)
 */
function isOwnerNameMatchCaseInsensitive(nameToCheck) {
    const currentOwner = getOwnerName();
    return currentOwner.toLowerCase() === nameToCheck.toLowerCase();
}

module.exports = {
    getOwnerName,
    setOwnerName,
    resetOwnerName,
    handleSetOwnerCommand,
    formatOwnerName,
    validateOwnerName,
    getOwnerInfo,
    isOwnerNameMatch,
    isOwnerNameMatchCaseInsensitive,
    DEFAULT_OWNER_NAME
};
