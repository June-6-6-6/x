/**
 * june md Bot - A WhatsApp Bot
 * Tennor-modz 
 * © 2025 supreme
 * * NOTE: This is the combined codebase. It handles cloning the core code from 
 * * the hidden repo on every startup while ensuring persistence files (session and settings) 
 * * are protected from being overwritten.
 */

// --- Environment Setup ---
const config = require('./config');
/*━━━━━━━━━━━━━━━━━━━━*/
require('dotenv').config(); // CRITICAL: Load .env variables first!
// *******************************************************************
// *** CRITICAL CHANGE: REQUIRED FILES (settings.js, main, etc.) ***
// *** HAVE BEEN REMOVED FROM HERE AND MOVED BELOW THE CLONER RUN. ***
// *******************************************************************

const fs = require('fs')
const chalk = require('chalk')
const path = require('path')
const axios = require('axios')
const os = require('os')
const PhoneNumber = require('awesome-phonenumber')
// The smsg utility also depends on other files, so we'll move its require statement.
// const { smsg } = require('./lib/myfunc') 
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay 
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { rmSync } = require('fs')

// --- 🌟 NEW: Centralized Logging Function ---
/**
 * Custom logging function to enforce the [ JUNE - MD ] prefix and styling.
 * @param {string} message - The message to log.
 * @param {string} [color='white'] - The chalk color (e.g., 'green', 'red', 'yellow').
 * @param {boolean} [isError=false] - Whether to use console.error.
 */
function log(message, color = 'white', isError = false) {
    const prefix = chalk.magenta.bold('[ JUNE - MD ]');
    const logFunc = isError ? console.error : console.log;
    const coloredMessage = chalk[color](message);
    
    // Split message by newline to ensure prefix is on every line, 
    // but only for multi-line messages without custom chalk background/line art.
    if (message.includes('\n') || message.includes('════')) {
        logFunc(prefix, coloredMessage);
    } else {
         logFunc(`${prefix} ${coloredMessage}`);
    }
}
// -------------------------------------------


// --- GLOBAL FLAGS ---
global.isBotConnected = false; 
global.connectDebounceTimeout = null;
// --- NEW: Error State Management ---
global.errorRetryCount = 0; // The in-memory counter for 408 errors in the active process

// ***************************************************************
// *** DEPENDENCIES MOVED DOWN HERE (AFTER THE CLONING IS COMPLETE) ***
// ***************************************************************

// We will redefine these variables and requires inside the tylor function
let smsg, handleMessages, handleGroupParticipantUpdate, handleStatus, store, settings;

// --- 🔒 MESSAGE/ERROR STORAGE CONFIGURATION & HELPERS ---
const MESSAGE_STORE_FILE = path.join(__dirname, 'message_backup.json');
// --- NEW: Error Counter File ---
const SESSION_ERROR_FILE = path.join(__dirname, 'sessionErrorCount.json');
global.messageBackup = {};

function loadStoredMessages() {
    try {
        if (fs.existsSync(MESSAGE_STORE_FILE)) {
            const data = fs.readFileSync(MESSAGE_STORE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading message backup store: ${error.message}`, 'red', true);
    }
    return {};
}

function saveStoredMessages(data) {
    try {
        fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving message backup store: ${error.message}`, 'red', true);
    }
}
global.messageBackup = loadStoredMessages();

// --- NEW: Error Counter Helpers ---
function loadErrorCount() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            const data = fs.readFileSync(SESSION_ERROR_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Error loading session error count: ${error.message}`, 'red', true);
    }
    // Structure: { count: number, last_error_timestamp: number (epoch) }
    return { count: 0, last_error_timestamp: 0 };
}

function saveErrorCount(data) {
    try {
        fs.writeFileSync(SESSION_ERROR_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log(`Error saving session error count: ${error.message}`, 'red', true);
    }
}

function deleteErrorCountFile() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            fs.unlinkSync(SESSION_ERROR_FILE);
            log('✅ Deleted sessionErrorCount.json.', 'red');
        }
    } catch (e) {
        log(`Failed to delete sessionErrorCount.json: ${e.message}`, 'red', true);
    }
}


// --- ♻️ CLEANUP FUNCTIONS ---

/**
 * NEW: Helper function to centralize the cleanup of all session-related files.
 */
function clearSessionFiles() {
    try {
        log('🗑️ Clearing session folder...', 'blue');
        // Delete the entire session directory
        rmSync(sessionDir, { recursive: true, force: true });
        // Delete login file if it exists
        if (fs.existsSync(loginFile)) fs.unlinkSync(loginFile);
        // Delete error count file
        deleteErrorCountFile();
        global.errorRetryCount = 0; // Reset in-memory counter
        log('✅ Session files cleaned successfully.', 'green');
    } catch (e) {
        log(`Failed to clear session files: ${e.message}`, 'red', true);
    }
}


function cleanupOldMessages() {
    let storedMessages = loadStoredMessages();
    let now = Math.floor(Date.now() / 1000);
    const maxMessageAge = 24 * 60 * 60;
    let cleanedMessages = {};
    for (let chatId in storedMessages) {
        let newChatMessages = {};
        for (let messageId in storedMessages[chatId]) {
            let message = storedMessages[chatId][messageId];
            if (now - message.timestamp <= maxMessageAge) {
                newChatMessages[messageId] = message; 
            }
        }
        if (Object.keys(newChatMessages).length > 0) {
            cleanedMessages[chatId] = newChatMessages; 
        }
    }
    saveStoredMessages(cleanedMessages);
    log("🧹 [Msg Cleanup] Old messages removed from message_backup.json", 'yellow');
}

function cleanupJunkFiles(botSocket) {
    let directoryPath = path.join(); 
    fs.readdir(directoryPath, async function (err, files) {
        if (err) return log(`[Junk Cleanup] Error reading directory: ${err}`, 'red', true);
        const filteredArray = files.filter(item =>
            item.endsWith(".gif") || item.endsWith(".png") || item.endsWith(".mp3") ||
            item.endsWith(".mp4") || item.endsWith(".opus") || item.endsWith(".jpg") ||
            item.endsWith(".webp") || item.endsWith(".webm") || item.endsWith(".zip")
        );
        if (filteredArray.length > 0) {
            let teks = `Detected ${filteredArray.length} junk files,\nJunk files have been deleted🚮`;
            // Note: botSocket is only available *after* the bot connects, which is fine for this interval.
            if (botSocket && botSocket.user && botSocket.user.id) {
                botSocket.sendMessage(botSocket.user.id.split(':')[0] + '@s.whatsapp.net', { text: teks });
            }
            filteredArray.forEach(function (file) {
                const filePath = path.join(directoryPath, file);
                try {
                    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch(e) {
                    log(`[Junk Cleanup] Failed to delete file ${file}: ${e.message}`, 'red', true);
                }
            });
            log(`[Junk Cleanup] ${filteredArray.length} files deleted.`, 'yellow');
        }
    });
}

// --- JUNE MD ORIGINAL CODE START ---
global.botname = "JUNE MD"
global.themeemoji = "•"
const pairingCode = !!global.phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// --- Readline setup (JUNE MD) ---
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
// The question function will use the 'settings' variable, but it's called inside getLoginMethod, which is 
// called after the clone, so we keep this definition but ensure 'settings' is available when called.
const question = (text) => rl ? new Promise(resolve => rl.question(text, resolve)) : Promise.resolve(settings?.ownerNumber || global.phoneNumber)

/*━━━━━━━━━━━━━━━━━━━━*/
// --- Paths (JUNE MD) ---
/*━━━━━━━━━━━━━━━━━━━━*/
const sessionDir = path.join(__dirname, 'session')
const credsPath = path.join(sessionDir, 'creds.json')
const loginFile = path.join(sessionDir, 'login.json')
const envPath = path.join(process.cwd(), '.env');
//const envPath = path.join(__dirname, '.env') // Path to the .env file

/*━━━━━━━━━━━━━━━━━━━━*/
// --- Login persistence (JUNE MD) ---
/*━━━━━━━━━━━━━━━━━━━━*/

async function saveLoginMethod(method) {
    await fs.promises.mkdir(sessionDir, { recursive: true });
    await fs.promises.writeFile(loginFile, JSON.stringify({ method }, null, 2));
}

async function getLastLoginMethod() {
    if (fs.existsSync(loginFile)) {
        const data = JSON.parse(fs.readFileSync(loginFile, 'utf-8'));
        return data.method;
    }
    return null;
}

// --- Session check (JUNE MD) ---
function sessionExists() {
    return fs.existsSync(credsPath);
}

// --- NEW: Check and use SESSION_ID from .env/environment variables ---
async function checkEnvSession() {
    const envSessionID = process.env.SESSION_ID;
    if (envSessionID) {
        if (!envSessionID.includes("JUNE-MD:~")) { 
            log("🚨 WARNING: Environment SESSION_ID is missing the required prefix 'JUNE-MD:~'. Assuming BASE64 format.", 'red'); 
        }
        global.SESSION_ID = envSessionID.trim();
        return true;
    }
    return false;
}

/**
 * NEW LOGIC: Checks if SESSION_ID starts with "JUNE-MD". If not, cleans .env and restarts.
 */
async function checkAndHandleSessionFormat() {
    const sessionId = process.env.SESSION_ID;
    
    if (sessionId && sessionId.trim() !== '') {
        // Only check if it's set and non-empty
        if (!sessionId.trim().startsWith('JUNE-MD')) {
            log(chalk.red.bgBlack('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'), 'white');
            log(chalk.white.bgRed('❌ ERROR: Invalid SESSION_ID in .env'), 'white');
            log(chalk.white.bgRed('The session ID MUST start with "JUNE-MD".'), 'white');
            log(chalk.white.bgRed('Cleaning .env and creating new one...'), 'white');
            log(chalk.red.bgBlack('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'), 'white');
            
            try {
                let envContent = fs.readFileSync(envPath, 'utf8');
                
                // Use regex to replace only the SESSION_ID line while preserving other variables
                envContent = envContent.replace(/^SESSION_ID=.*$/m, 'SESSION_ID=');
                
                fs.writeFileSync(envPath, envContent);
                log('✅ Cleaned SESSION_ID entry in .env file.', 'green');
                log('Please add a proper session ID and restart the bot.', 'yellow');
            } catch (e) {
                log(`Failed to modify .env file. Please check permissions: ${e.message}`, 'red', true);
            }
            
            // Delay before exiting to allow user to read the message before automatic restart
            log('Bot will wait 30 seconds then restart', 'blue');
            await delay(30000);
            
            // Exit with code 1 to ensure the hosting environment restarts the process
            process.exit(1);
        }
    }
}


// --- Get login method (JUNE MD) ---
async function getLoginMethod() {
    const lastMethod = await getLastLoginMethod();
    if (lastMethod && sessionExists()) {
        log(`Last login method detected: ${lastMethod}. Using it automatically.`, 'yellow');
        return lastMethod;
    }
    
    if (!sessionExists() && fs.existsSync(loginFile)) {
        log(`Session files missing. Removing old login preference for clean re-login.`, 'yellow');
        fs.unlinkSync(loginFile);
    }

    // Interactive prompt for Pterodactyl/local
    if (!process.stdin.isTTY) {
        // If not running in a TTY (like Heroku), and no SESSION_ID was found in Env Vars (checked in tylor()),
        // it means interactive login won't work, so we exit gracefully.
        log("❌ No Session ID found in environment variables.", 'red');
        process.exit(1);
    }


    log("Choose login method:", 'yellow');
    log("1) Enter WhatsApp Number (Pairing Code)", 'blue');
    log("2) Paste Session ID", 'blue');

    let choice = await question("Enter option number (1 or 2): ");
    choice = choice.trim();

    if (choice === '1') {
        let phone = await question(chalk.bgBlack(chalk.greenBright(`Enter your WhatsApp number (e.g., 254798570132): `)));
        phone = phone.replace(/[^0-9]/g, '');
        const pn = require('awesome-phonenumber');
        if (!pn('+' + phone).isValid()) { log('Invalid phone number.', 'red'); return getLoginMethod(); }
        global.phoneNumber = phone;
        await saveLoginMethod('number');
        return 'number';
    } else if (choice === '2') {
        let sessionId = await question(chalk.bgBlack(chalk.greenBright(`Paste your Session ID here: `)));
        sessionId = sessionId.trim();
        // Pre-check the format during interactive entry as well
        if (!sessionId.includes("JUNE-MD:~")) { 
            log("Invalid Session ID format! Must contain 'JUNE-MD:~'.", 'red'); 
            process.exit(1); 
        }
        global.SESSION_ID = sessionId;
        await saveLoginMethod('session');
        return 'session';
    } else {
        log("Invalid option! Please choose 1 or 2.", 'red');
        return getLoginMethod();
    }
}

// --- Download session (JUNE MD) ---
async function downloadSessionData() {
    try {
        await fs.promises.mkdir(sessionDir, { recursive: true });
        if (!fs.existsSync(credsPath) && global.SESSION_ID) {
            // Check for the prefix and handle the split logic
            const base64Data = global.SESSION_ID.includes("JUNE-MD:~") ? global.SESSION_ID.split("JUNE-MD:~")[1] : global.SESSION_ID;
            const sessionData = Buffer.from(base64Data, 'base64');
            await fs.promises.writeFile(credsPath, sessionData);
            log(`Session successfully saved.`, 'green');
        }
    } catch (err) { log(`Error downloading session data: ${err.message}`, 'red', true); }
}

// --- Request pairing code (JUNE MD) ---
async function requestPairingCode(socket) {
    try {
        log("Waiting 3 seconds for socket stabilization before requesting pairing code...", 'yellow');
        await delay(3000); 

        let code = await socket.requestPairingCode(global.phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        log(chalk.bgGreen.black(`\nYour Pairing Code: ${code}\n`), 'white');
        log(`
Please enter this code in WhatsApp app:
1. Open WhatsApp
2. Go to Settings => Linked Devices
3. Tap "Link a Device"
4. Enter the code shown above
        `, 'blue');
        return true; 
    } catch (err) { 
        log(`Failed to get pairing code: ${err.message}`, 'red', true); 
        return false; 
    }
}

// --- Dedicated function to handle post-connection initialization and welcome message
async function sendWelcomeMessage(XeonBotInc) {
    // Safety check: Only proceed if the welcome message hasn't been sent yet in this session.
    if (global.isBotConnected) return; 
    
    // CRITICAL: Wait 10 seconds for the connection to fully stabilize
    await delay(10000); 

    // 🧩 Host Detection Function
function detectHost() {
    const env = process.env;

    if (env.RENDER || env.RENDER_EXTERNAL_URL) return 'Render';
    if (env.DYNO || env.HEROKU_APP_DIR || env.HEROKU_SLUG_COMMIT) return 'Heroku';
    if (env.PORTS || env.CYPHERX_HOST_ID) return "CypherXHost"; 
    if (env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL) return 'Vercel';
    if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID) return 'Railway';
    if (env.REPL_ID || env.REPL_SLUG) return 'Replit';

    const hostname = os.hostname().toLowerCase();
    if (!env.CLOUD_PROVIDER && !env.DYNO && !env.VERCEL && !env.RENDER) {
        if (hostname.includes('vps') || hostname.includes('server')) return 'VPS';
        return 'Panel';
    }

    return 'Unknown Host';
}
    

    try {

        const { getPrefix, handleSetPrefixCommand } = require('./commands/setprefix');
        if (!XeonBotInc.user || global.isBotConnected) return;

        global.isBotConnected = true;
        const pNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
        let data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
        const currentMode = data.isPublic ? 'public' : 'private';    
        const hostName = detectHost();
        const prefix = getPrefix();

        // Send the message
        await XeonBotInc.sendMessage(pNumber, {
            text: `
┏━━━━━✧ CONNECTED ✧━━━━━━━
┃✧ Prefix: [${prefix}]
┃✧ mode: ${currentMode}
┃✧ Platform: ${hostName}
┃✧ Bot: JUNE MD
┃✧ Status: Active
┃✧ Time: ${new Date().toLocaleString()}
┗━━━━━━━━━━━━━━━━━━━`
        });
        log('✅ Bot successfully connected to Whatsapp.', 'green');

        //auto follow group functions
        try {
                await XeonBotInc.groupAcceptInvite('Hd14oCh8LT1A3EheIpZycL');
                console.log(chalk.blue(`✅ auto-joined WhatsApp group successfully`));
             } catch (e) {
                console.log(chalk.red(`❌ failed to join WhatsApp group: ${e}`));
                }

                    

        // NEW: Reset the error counter on successful connection
        deleteErrorCountFile();
        global.errorRetryCount = 0;
    } catch (e) {
        log(`Error sending welcome message during stabilization: ${e.message}`, 'red', true);
        global.isBotConnected = false;
    }
}

/**
 * NEW FUNCTION: Handles the logic for persistent 408 (timeout) errors.
 * @param {number} statusCode The disconnect status code.
 */
async function handle408Error(statusCode) {async function handle408Error(statusCode) {
    // Validate required dependencies
    if (typeof DisconnectReason === 'undefined') {
        console.error('DisconnectReason is not defined');
        return false;
    }
    
    // Only proceed for 408 Timeout errors
    if (statusCode !== DisconnectReason.connectionTimeout) return false;
    
    // Initialize counter if not exists
    if (typeof global.errorRetryCount !== 'number') {
        global.errorRetryCount = 0;
    }
    
    let errorState;
    try {
        errorState = await loadErrorCount();
    } catch (error) {
        console.error('Failed to load error count:', error);
        errorState = { count: 0, last_error_timestamp: Date.now() };
    }
    
    const MAX_RETRIES = 3;
    
    // Update counters atomically
    global.errorRetryCount++;
    errorState.count = global.errorRetryCount;
    errorState.last_error_timestamp = Date.now();
    
    try {
        await saveErrorCount(errorState);
    } catch (error) {
        console.error('Failed to save error count:', error);
    }

    console.log(`Connection Timeout (408) detected. Retry count: ${global.errorRetryCount}/${MAX_RETRIES}`);
    
    if (global.errorRetryCount >= MAX_RETRIES) {
        console.error('=================================================');
        console.error(`🚨 MAX CONNECTION TIMEOUTS (${MAX_RETRIES}) REACHED IN ACTIVE STATE.`);
        console.error('This indicates a persistent network or session issue.');
        console.error('Exiting process to stop infinite restart loop.');
        console.error('=================================================');

        try {
            await deleteErrorCountFile();
        } catch (error) {
            console.error('Failed to delete error count file:', error);
        }
        
        global.errorRetryCount = 0; // Reset in-memory counter
        
        // Graceful shutdown with cleanup time
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Consider graceful shutdown instead of hard exit
        if (typeof process.emit === 'function') {
            process.emit('cleanup');
        }
        process.exit(1);
    }
    return true;
}
async function safeHandle408Error(statusCode) {
    try {
        return await handle408Error(statusCode);
    } catch (error) {
        console.error('Error in handle408Error:', error);
        return false;
    }
}



// --- Start bot (JUNE MD) ---
// Add connection state management
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
let isConnecting = false;
let currentConnection = null;

async function startXeonBotInc() {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
        log('Connection already in progress, skipping...', 'yellow');
        return currentConnection;
    }

    isConnecting = true;
    connectionAttempts++;

    try {
        log('Connecting to WhatsApp...', 'cyan');
        
        // Validate critical dependencies
        if (typeof fetchLatestBaileysVersion === 'undefined') {
            throw new Error('fetchLatestBaileysVersion is not available');
        }

        const { version } = await fetchLatestBaileysVersion();
        
        // Ensure session directory exists
        await fs.promises.mkdir(sessionDir, { recursive: true });

        // Run session integrity check before proceeding
        await checkSessionIntegrityAndClean();

        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        const msgRetryCounterCache = new NodeCache();

        // Clean up previous connection if exists
        if (currentConnection) {
            try {
                await currentConnection.ws.close();
                currentConnection.ev.removeAllListeners();
            } catch (e) {
                log(`Cleanup of previous connection: ${e.message}`, 'yellow');
            }
        }

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false, 
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: true,
            getMessage: async (key) => {
                try {
                    let jid = jidNormalizedUser(key.remoteJid);
                    if (store && typeof store.loadMessage === 'function') {
                        let msg = await store.loadMessage(jid, key.id); 
                        return msg?.message || "";
                    }
                    return "";
                } catch (error) {
                    log(`Error loading message: ${error.message}`, 'red');
                    return "";
                }
            },
            msgRetryCounterCache
        });

        // Store current connection
        currentConnection = XeonBotInc;

        // Bind store if available
        if (store && typeof store.bind === 'function') {
            store.bind(XeonBotInc.ev);
        }

        // --- 🚨 MESSAGE LOGGER (with error handling) ---
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                if (!chatUpdate.messages || !Array.isArray(chatUpdate.messages)) return;
                
                // Message backup logic
                for (const msg of chatUpdate.messages) {
                    if (!msg.message) continue;
                    let chatId = msg.key.remoteJid;
                    let messageId = msg.key.id;
                    
                    if (!global.messageBackup) global.messageBackup = {};
                    if (!global.messageBackup[chatId]) global.messageBackup[chatId] = {};
                    
                    let textMessage = msg.message?.conversation || 
                                    msg.message?.extendedTextMessage?.text || null;
                    if (!textMessage) continue;
                    
                    let savedMessage = { 
                        sender: msg.key.participant || msg.key.remoteJid, 
                        text: textMessage, 
                        timestamp: msg.messageTimestamp 
                    };
                    
                    if (!global.messageBackup[chatId][messageId]) {
                        global.messageBackup[chatId][messageId] = savedMessage;
                        if (typeof saveStoredMessages === 'function') {
                            saveStoredMessages(global.messageBackup);
                        }
                    }
                }

                // --- Message handler logic ---
                const mek = chatUpdate.messages[0];
                if (!mek.message) return;
                
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') 
                    ? mek.message.ephemeralMessage.message 
                    : mek.message;

                if (mek.key.remoteJid === 'status@broadcast') {
                    if (typeof handleStatus === 'function') {
                        await handleStatus(XeonBotInc, chatUpdate);
                    }
                    return;
                }
                
                if (typeof handleMessages === 'function') {
                    await handleMessages(XeonBotInc, chatUpdate, true);
                }
            } catch (error) {
                log(`Error in messages.upsert: ${error.message}`, 'red');
            }
        });

        // --- ⚠️ CONNECTION UPDATE LISTENER (Fixed) ---
        const connectionHandler = async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (connection === 'close') {
                global.isBotConnected = false;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const permanentLogout = statusCode === DisconnectReason.loggedOut || statusCode === 401;
                
                if (permanentLogout) {
                    log(chalk.bgRed.black(`\n\n🚨 WhatsApp Disconnected! Status Code: ${statusCode} (LOGGED OUT / INVALID SESSION).`), 'white');
                    log('🗑️ Deleting session folder and forcing a clean restart...', 'red');
                    
                    clearSessionFiles();
                    
                    log('✅ Session cleaned. Initiating full process restart in 5 seconds...', 'red');
                    await delay(5000);
                    process.exit(1);
                } else {
                    const is408Handled = await handle408Error(statusCode);
                    if (is408Handled) return;

                    log(`Connection closed (Status: ${statusCode}). Attempting reconnect...`, 'yellow');
                    
                    // Use delayed restart instead of immediate recursion
                    setTimeout(() => {
                        if (connectionAttempts <= MAX_CONNECTION_ATTEMPTS) {
                            startXeonBotInc();
                        } else {
                            log(`Max connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached. Exiting.`, 'red');
                            process.exit(1);
                        }
                    }, 5000);
                }
            } else if (connection === 'open') {
                connectionAttempts = 0; // Reset on successful connection
                global.isBotConnected = true;
                
                console.log(chalk.yellow(`💅 Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)));
                log('JUNE X connected', 'yellow');      
                log(`Github: Vinpink2`, 'magenta');
                
                // Newsletter follow with error handling
                try {
                    const jid2 = '120363423767541304@newsletter';
                    await XeonBotInc.newsletterFollow(jid2);
                    log('✅ followed newsletter successfully', 'green');
                } catch (e) {
                    log(`❌ failed to join WhatsApp channel: ${e}`, 'red');
                }
                
                await sendWelcomeMessage(XeonBotInc);
            }
        };

        XeonBotInc.ev.on('connection.update', connectionHandler);
        XeonBotInc.ev.on('creds.update', saveCreds);
        
        XeonBotInc.public = true;
        
        if (typeof smsg === 'function') {
            XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);
        }

        // Setup intervals (only once)
        setupBackgroundIntervals(XeonBotInc);

        isConnecting = false;
        return XeonBotInc;

    } catch (error) {
        isConnecting = false;
        log(`Failed to start bot: ${error.message}`, 'red');
        
        // Retry logic with exponential backoff
        if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
            const delayTime = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
            log(`Retrying connection in ${delayTime/1000}s... (Attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`, 'yellow');
            setTimeout(startXeonBotInc, delayTime);
        } else {
            log(`Max connection attempts reached. Giving up.`, 'red');
            process.exit(1);
        }
    }
}

// Separate function for interval setup
function setupBackgroundIntervals(XeonBotInc) {
    // Clear any existing intervals
    if (global.backgroundIntervals) {
        global.backgroundIntervals.forEach(clearInterval);
    }
    
    global.backgroundIntervals = [];
    
    // Session cleanup
    const sessionInterval = setInterval(() => {
        // ... (your existing session cleanup logic)
    }, 7200000);
    global.backgroundIntervals.push(sessionInterval);
    
    // Message cleanup
    if (typeof cleanupOldMessages === 'function') {
        const messageInterval = setInterval(cleanupOldMessages, 60 * 60 * 1000);
        global.backgroundIntervals.push(messageInterval);
    }
    
    // Junk cleanup
    if (typeof cleanupJunkFiles === 'function') {
        const junkInterval = setInterval(() => cleanupJunkFiles(XeonBotInc), 30000);
        global.backgroundIntervals.push(junkInterval);
    }
}

// --- 🌟 NEW: .env File Watcher for Automated Restart ---
/**
 * Monitors the .env file for changes and forces a process restart.
 * Made mandatory to ensure SESSION_ID changes are always picked up.
 * @private 
 */
function checkEnvStatus() {
    try {
        log("╔══════════════════════════", 'green');
        log(`║ .env file watcher `, 'green');
        log("╚══════════════════════════", 'green');
        
        // Use persistent: false for better behavior in some hosting environments
        // Always set the watcher regardless of the environment
        fs.watch(envPath, { persistent: false }, (eventType, filename) => {
            if (filename && eventType === 'change') {
                log(chalk.bgRed.black('================================================='), 'white');
                log(chalk.white.bgRed('🚨 .env file change detected!'), 'white');
                log(chalk.white.bgRed('Forcing a clean restart to apply new configuration (e.g., SESSION_ID).'), 'white');
                log(chalk.red.bgBlack('================================================='), 'white');
                
                // Use process.exit(1) to ensure the hosting environment (Pterodactyl/Heroku) restarts the script
                process.exit(1);
            }
        });
    } catch (e) {
        log(`❌ Failed to set up .env file watcher (fs.watch error): ${e.message}`, 'red', true);
        // Do not exit, as the bot can still run, but notify the user
    }
}
// -------------------------------------------------------------


// --- Main login flow (JUNE MD) ---
// Global state to track initialization
let isInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

async function tylor() {
    // Prevent multiple simultaneous initializations
    if (isInitialized) {
        log('⚠️ Initialization already in progress', 'yellow');
        return;
    }

    isInitialized = true;
    initializationAttempts++;

    try {
        log('🚀 Starting JUNE MD initialization...', 'cyan');

        // 1. MANDATORY: Run the codebase cloner FIRST
        // await downloadAndSetupCodebase();

        // *************************************************************
        // *** CRITICAL: REQUIRED FILES MUST BE LOADED AFTER CLONING ***
        // *************************************************************
        await loadCoreModules();
        
        // 2. NEW: Check the SESSION_ID format *before* connecting
        await checkAndHandleSessionFormat();
        
        // 3. Set the global in-memory retry count with error handling
        await initializeErrorRetryCount();
        
        // 4. *** IMPLEMENT USER'S PRIORITY LOGIC: Check .env SESSION_ID FIRST ***
        const envSessionID = process.env.SESSION_ID?.trim();

        if (envSessionID && envSessionID.startsWith('JUNE-MD')) { 
            await handleEnvSessionMode(envSessionID);
            return;
        }
        
        // If environment session is NOT set, or not valid, continue with fallback logic:
        log("ℹ️ No new SESSION_ID found in .env. Falling back to stored session or interactive login.", 'yellow');

        // 5. Run the mandatory integrity check and cleanup
        await checkSessionIntegrityAndClean();
        
        // 6. Check for a valid *stored* session after cleanup
        if (await sessionExists()) {
            await handleStoredSessionMode();
            return;
        }
        
        // 7. New Login Flow (If no valid session exists)
        await handleNewLoginFlow();
        
    } catch (error) {
        log(`❌ Initialization failed: ${error.message}`, 'red', true);
        
        // Reset initialization state
        isInitialized = false;
        
        // Retry logic with exponential backoff
        if (initializationAttempts < MAX_INIT_ATTEMPTS) {
            const delayTime = Math.min(1000 * Math.pow(2, initializationAttempts), 10000);
            log(`🔄 Retrying initialization in ${delayTime/1000}s... (Attempt ${initializationAttempts}/${MAX_INIT_ATTEMPTS})`, 'yellow');
            await delay(delayTime);
            return tylor();
        } else {
            log(`💥 Max initialization attempts (${MAX_INIT_ATTEMPTS}) reached. Manual intervention required.`, 'red');
            process.exit(1);
        }
    }
}

// ==================== HELPER FUNCTIONS ====================

async function loadCoreModules() {
    const requiredModules = [
        { path: './settings', name: 'settings' },
        { path: './main', name: 'main' },
        { path: './lib/myfunc', name: 'myfunc' },
        { path: './lib/lightweight_store', name: 'lightweight_store' }
    ];

    for (const module of requiredModules) {
        try {
            if (module.path === './settings') {
                require(module.path);
            } else if (module.path === './main') {
                const mainModules = require(module.path);
                if (!mainModules.handleMessages || !mainModules.handleGroupParticipantUpdate || !mainModules.handleStatus) {
                    throw new Error(`Main module missing required exports`);
                }
                handleMessages = mainModules.handleMessages;
                handleGroupParticipantUpdate = mainModules.handleGroupParticipantUpdate;
                handleStatus = mainModules.handleStatus;
            } else if (module.path === './lib/myfunc') {
                const myfuncModule = require(module.path);
                if (!myfuncModule.smsg) {
                    throw new Error('smsg function not found in myfunc module');
                }
                smsg = myfuncModule.smsg;
            } else if (module.path === './lib/lightweight_store') {
                store = require(module.path);
                if (typeof store.readFromFile !== 'function') {
                    throw new Error('Store module missing readFromFile method');
                }
                store.readFromFile();
                
                // Setup store auto-save
                settings = require('./settings');
                if (settings.storeWriteInterval) {
                    setInterval(() => {
                        try {
                            store.writeToFile();
                        } catch (e) {
                            log(`Store write error: ${e.message}`, 'red');
                        }
                    }, settings.storeWriteInterval);
                }
            }
        } catch (error) {
            throw new Error(`Failed to load ${module.name}: ${error.message}`);
        }
    }
    
    log("✨ Core files loaded successfully.", 'green');
}

async function initializeErrorRetryCount() {
    try {
        const errorState = loadErrorCount();
        global.errorRetryCount = errorState.count || 0;
        log(`📊 Retrieved initial 408 retry count: ${global.errorRetryCount}`, 'yellow');
    } catch (error) {
        log(`⚠️ Could not load error retry count: ${error.message}`, 'yellow');
        global.errorRetryCount = 0;
    }
}

async function handleEnvSessionMode(envSessionID) {
    log("🔥 PRIORITY MODE: Found new/updated SESSION_ID in .env/environment variables.", 'magenta');
    
    // Force the use of the new session by cleaning any old persistent files.
    await clearSessionFiles(); 
    
    // Set global and download the new session file (creds.json) from the .env value.
    global.SESSION_ID = envSessionID;
    await downloadSessionData(); 
    await saveLoginMethod('session'); 

    // Start bot with the newly created session files
    log("✅ Valid session found (from .env), starting bot directly...", 'green');
    log('⏳ Waiting 3 seconds for stable connection...', 'yellow'); 
    await delay(3000);
    
    await startXeonBotInc();
    
    // Start the file watcher
    await checkEnvStatus();
}

async function handleStoredSessionMode() {
    log("✅ Valid stored session found, starting bot directly...", 'green'); 
    log('⏳ Waiting 3 seconds for stable connection...', 'yellow');
    await delay(3000);
    
    await startXeonBotInc();
    
    // Start the file watcher
    await checkEnvStatus();
}

async function handleNewLoginFlow() {
    const loginMethod = await getLoginMethod();
    let XeonBotInc;

    if (loginMethod === 'session') {
        await downloadSessionData();
        // Socket is only created AFTER session data is saved
        XeonBotInc = await startXeonBotInc(); 
    } else if (loginMethod === 'number') {
        // Socket is created BEFORE pairing code is requested
        XeonBotInc = await startXeonBotInc();
        await requestPairingCode(XeonBotInc); 
    } else {
        throw new Error("Failed to get valid login method");
    }
    
    // Final Cleanup After Pairing Attempt Failure
    if (loginMethod === 'number' && !(await sessionExists()) && fs.existsSync(sessionDir)) {
        log('❌ Login interrupted/failed. Clearing temporary session files and restarting...', 'red');
        await clearSessionFiles();
        throw new Error('Login failed - restarting');
    }
    
    // Start the file watcher after an interactive login completes successfully
    await checkEnvStatus();
}

// Enhanced session existence check
async function sessionExists() {
    try {
        const credsPath = path.join(sessionDir, 'creds.json');
        if (!fs.existsSync(credsPath)) return false;
        
        const stats = await fs.promises.stat(credsPath);
        if (stats.size === 0) return false;
        
        const creds = JSON.parse(await fs.promises.readFile(credsPath, 'utf8'));
        return creds && creds.noiseKey && creds.signedIdentityKey;
    } catch (error) {
        log(`Session existence check failed: ${error.message}`, 'yellow');
        return false;
    }
}

// ==================== STARTUP EXECUTION ====================

// Global error handlers
process.on('uncaughtException', (err) => {
    log(`💥 Uncaught Exception: ${err.message}`, 'red', true);
    log(`Stack: ${err.stack}`, 'red');
    // Don't exit immediately, allow the bot to attempt recovery
});

process.on('unhandledRejection', (reason, promise) => {
    log(`💥 Unhandled Rejection at: ${promise}, reason: ${reason}`, 'red', true);
});

// Start the bot with proper error handling
tylor().catch(err => log(`Fatal error starting bot: ${err.message}`, 'red', true));
process.on('uncaughtException', (err) => log(`Uncaught Exception: ${err.message}`, 'red', true));
process.on('unhandledRejection', (err) => log(`Unhandled Rejection: ${err.message}`, 'red', true));
