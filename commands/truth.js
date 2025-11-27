async function truthCommand(sock, chatId, message) {
    try {
        const truths = [
            "What's the most embarrassing thing that's happened to you recently?",
            "Have you ever had a crush on a teacher? Tell us about it.",
            "What's the biggest lie you've ever told your parents?",
            "What's the most childish thing you still do?",
            "Have you ever pretended to be sick to get out of something?",
            "What's the weirdest food combination you enjoy?",
            "What's a secret you've never told anyone?",
            "What's the most trouble you've ever been in?",
            "Have you ever cheated on a test?",
            "What's your most irrational fear?",
            "What's the cringiest thing you did to try to impress someone?",
            "What's something you've stolen and never returned?",
            "Have you ever had a dream about someone in this chat?",
            "What's the worst date you've ever been on?",
            "What's a habit you have that you're embarrassed about?",
            "What's the most embarrassing song on your playlist?",
            "Have you ever been caught doing something you shouldn't have?",
            "What's the silliest thing you've cried over?",
            "What's something you're secretly proud of?",
            "What's the most embarrassing nickname you've ever had?",
            "Have you ever ghosted someone? Why?",
            "What's the most awkward thing that's happened to you on a date?",
            "What's something you Google that you'd be embarrassed if people saw?",
            "What's your guilty pleasure TV show?",
            "What's the strangest thing you find attractive in someone?"
        ];

        // Get random truth
        const randomIndex = Math.floor(Math.random() * truths.length);
        const truthMessage = truths[randomIndex];

        // Send the truth message
        await sock.sendMessage(chatId, { text: truthMessage }, { quoted: message });
    } catch (error) {
        console.error('Error in truth command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to get truth. Please try again later!' }, { quoted: message });
    }
}

module.exports = { truthCommand };
