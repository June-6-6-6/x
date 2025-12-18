async function devReact(sock, chatId, message) {
    // Extract sender number correctly
    const sender = message.key.participant || message.key.remoteJid;
    const senderNumber = sender ? sender.split('@')[0] : null;
    
    // Define dev numbers (comma-separated or array)
    const devNumbers = ['254794898005']; // Single number or ['num1', 'num2']
    
    // Check if this is already a reaction message to avoid loops
    const isReactionMessage = message.message?.reactionMessage;
    const isFromMe = message.key.fromMe;
    
    // If it's already a reaction or not from a dev, skip
    if (isReactionMessage || isFromMe) {
        return;
    }
    
    // Check if sender is a dev
    if (senderNumber && devNumbers.includes(senderNumber)) {
        try {
            // Send shield reaction
            await sock.sendMessage(chatId, {
                react: {
                    text: "🛡",
                    key: message.key
                }
            });
            console.log(`Reacted to message from dev: ${senderNumber}`);
        } catch (error) {
            console.error("Failed to send reaction:", error);
        }
    }
}
