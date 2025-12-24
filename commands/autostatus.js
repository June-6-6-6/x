const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/autoStatus.json');
const randomEmojis = ['❤️','😂','😮','😢','😡','👏','🔥','⭐','🎉','🙏','👍','👎','💯','🤔','🤯','😍','🥰','🤗','😎','🤩'];

const defaultConfig = {
  enabled: false,
  reactOn: false,
  reactionEmoji: '🖤',
  randomReactions: true,
  dryRun: false // NEW: soft run mode
};

// --- Config Helpers ---
function readConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      writeConfig(defaultConfig);
      return defaultConfig;
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return defaultConfig;
  }
}

function writeConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}

// --- Emoji Helpers ---
function getRandomEmoji() {
  return randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
}

function getReactionEmoji() {
  const config = readConfig();
  if (config.reactOn) {
    return config.randomReactions ? getRandomEmoji() : (config.reactionEmoji || '🖤');
  }
  return null; // Prevents unexpected reactions
}

// --- Status Checks ---
function isAutoStatusEnabled() {
  return readConfig().enabled;
}

function isStatusReactionEnabled() {
  const config = readConfig();
  return config.reactOn && !config.dryRun; // respect dryRun
}

// --- Reaction Logic ---
async function reactToStatus(sock, statusKey) {
  if (!isStatusReactionEnabled()) return;

  const emoji = getReactionEmoji();
  if (!emoji) return; // Guard against invalid emoji

  const config = readConfig();
  if (config.dryRun) {
    console.log(`[DryRun] Would react to status ${statusKey.id} with ${emoji}`);
    return;
  }

  try {
    await sock.relayMessage(
      'status@broadcast',
      {
        reactionMessage: {
          key: {
            remoteJid: 'status@broadcast',
            id: statusKey.id,
            participant: statusKey.participant || statusKey.remoteJid,
            fromMe: false
          },
          text: emoji
        }
      },
      {
        messageId: statusKey.id,
        statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
      }
    );
  } catch (error) {
    console.error('❌ Error reacting to status:', error.message);
  }
}

// --- Status Update Handler ---
async function handleStatusUpdate(sock, status) {
  const config = readConfig();
  if (!config.enabled) return;

  // Delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));

  let statusKey = status?.messages?.[0]?.key || status?.key || status?.reaction?.key;
  if (!statusKey || statusKey.remoteJid !== 'status@broadcast') return;

  try {
    if (config.dryRun) {
      console.log(`[DryRun] Would mark status ${statusKey.id} as viewed`);
    } else {
      await sock.readMessages([statusKey]);
    }

    await reactToStatus(sock, statusKey);
  } catch (err) {
    if (err.message?.includes('rate-overlimit')) {
      console.log('⚠️ Rate limit hit, retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await sock.readMessages([statusKey]);
    } else {
      console.error('❌ Error processing status:', err.message);
    }
  }
}

module.exports = {
  readConfig,
  writeConfig,
  getReactionEmoji,
  getRandomEmoji,
  isAutoStatusEnabled,
  isStatusReactionEnabled,
  reactToStatus,
  handleStatusUpdate
};
