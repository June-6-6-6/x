async function unmuteCommand(sock, chatId, time = null) {
    if (time) {
        // Parse the time and schedule unmute
        const delay = parseTimeToMs(time);
        if (delay === null) {
            await sock.sendMessage(chatId, { 
                text: 'Invalid time format. Please use formats like: "30m", "2h", "1d", or "in 2 hours"' 
            });
            return;
        }
        
        await sock.sendMessage(chatId, { 
            text: `✅ Group will be unmuted in ${formatTime(delay)}.` 
        });
        
        // Schedule the unmute
        setTimeout(async () => {
            try {
                await sock.groupSettingUpdate(chatId, 'not_announcement');
                await sock.sendMessage(chatId, { 
                    text: '🔊 The group has been automatically unmuted as scheduled.' 
                });
            } catch (error) {
                console.error('Error unmuting group:', error);
            }
        }, delay);
    } else {
        // Immediate unmute
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: '🔊 The group has been unmuted.' });
    }
}

// Helper function to parse time strings to milliseconds
function parseTimeToMs(timeString) {
    const time = timeString.toLowerCase().trim();
    
    // Remove "in " prefix if present
    const cleanTime = time.replace(/^in\s+/, '');
    
    // Match patterns like: 30m, 2h, 1d, 1h30m, etc.
    const regex = /(?:(\d+)\s*d(?:ays?)?)?\s*(?:(\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?\s*(?:(\d+)\s*s(?:ec(?:onds?)?)?)?/;
    const match = cleanTime.match(regex);
    
    if (!match) return null;
    
    const days = parseInt(match[1] || 0);
    const hours = parseInt(match[2] || 0);
    const minutes = parseInt(match[3] || 0);
    const seconds = parseInt(match[4] || 0);
    
    // If no time components found, return null
    if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
        return null;
    }
    
    return (days * 24 * 60 * 60 * 1000) + 
           (hours * 60 * 60 * 1000) + 
           (minutes * 60 * 1000) + 
           (seconds * 1000);
}

// Helper function to format time for display
function formatTime(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    
    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);
    
    return parts.join(', ');
}

module.exports = unmuteCommand;
