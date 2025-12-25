const fs = require('fs');

const ANTICALL_PATH = './data/anticall.json';

function readState() {
    try {
        if (!fs.existsSync(ANTICALL_PATH)) return { action: 'warn', enabled: false };
        const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
        const data = JSON.parse(raw || '{}');
        return { 
            action: data.action || 'warn', // block, warn, or endcall
            enabled: !!data.enabled 
        };
    } catch {
        return { action: 'warn', enabled: false };
    }
}

function writeState(action, enabled) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ 
            action: action || 'warn', 
            enabled: !!enabled 
        }, null, 2));
    } catch {}
}

async function anticallCommand(sock, chatId, message, args) {
    const state = readState();
    const sub = (args || '').trim().toLowerCase();

    if (!sub || !['on', 'off', 'status', 'block', 'warn', 'endcall'].includes(sub)) {
        await sock.sendMessage(chatId, { 
            text: '* ANTICALL SETTING *\n\n' +
                  '  .anticall on - Enable anticall protection\n' +
                  '  .anticall off - Disable anticall\n' +
                  '  .anticall status - Show current status\n' +
                  '  .anticall block - Auto-block users on call\n' +
                  '  .anticall warn - Send warning message on call\n' +
                  '  .anticall endcall - End the call immediately\n\n' +
                  `Current mode: *${state.action.toUpperCase()}* | Status: *${state.enabled ? 'ON' : 'OFF'}*`
        }, { quoted: message });
        return;
    }

    if (sub === 'status') {
        await sock.sendMessage(chatId, { 
            text: `*Anticall Status*\n\n` +
                  ` Status: *${state.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}*\n` +
                  ` Action: *${state.action.toUpperCase()}*\n\n` +
                  `Current action when someone calls:\n` +
                  `${state.action === 'block' ? '• 🚫 Block the user' : ''}` +
                  `${state.action === 'warn' ? '• ⚠️ Send warning message' : ''}` +
                  `${state.action === 'endcall' ? '• 📞 End the call immediately' : ''}`
        }, { quoted: message });
        return;
    }

    if (['block', 'warn', 'endcall'].includes(sub)) {
        writeState(sub, state.enabled);
        await sock.sendMessage(chatId, { 
            text: `Anticall action changed to *${sub.toUpperCase()}* mode.\n\n` +
                  `${sub === 'block' ? '🚫 Users will be blocked when they call' : ''}` +
                  `${sub === 'warn' ? '⚠️ Users will receive a warning when they call' : ''}` +
                  `${sub === 'endcall' ? '📞 Calls will be ended immediately' : ''}`
        }, { quoted: message });
        return;
    }

    const enable = sub === 'on';
    writeState(state.action, enable);
    await sock.sendMessage(chatId, { 
        text: `Anticall is now *${enable ? 'ENABLED ✅' : 'DISABLED ❌'}*.\n` +
              `Action mode: *${state.action.toUpperCase()}*\n\n` +
              `${enable ? `When someone calls, I will:` : ''}` +
              `${enable && state.action === 'block' ? '\n• 🚫 Block the user' : ''}` +
              `${enable && state.action === 'warn' ? '\n• ⚠️ Send warning message' : ''}` +
              `${enable && state.action === 'endcall' ? '\n• 📞 End the call immediately' : ''}`
    }, { quoted: message });
}

// 🔹 NEW: Handle incoming calls
async function handleIncomingCall(sock, callEvent) {
    const state = readState();
    if (!state.enabled) return;

    const callerId = callEvent.from; // JID of caller
    const action = state.action;

    if (action === 'warn') {
        await sock.sendMessage(callerId, { 
            text: '⚠️ Please do not call this bot. Use chat only.' 
        });
    }

    if (action === 'block') {
        await sock.updateBlockStatus(callerId, 'block'); // block the caller
        await sock.sendMessage(callerId, { 
            text: '🚫 You have been blocked for calling the bot.' 
        });
    }

    if (action === 'endcall') {
        // Baileys supports rejecting calls
        if (callEvent.id) {
            await sock.rejectCall(callEvent.id, callerId);
        }
        await sock.sendMessage(callerId, { 
            text: '📞 Your call was ended automatically. Please use chat only.' 
        });
    }
}

module.exports = { anticallCommand, readState, handleIncomingCall };
