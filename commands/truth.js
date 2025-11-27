const fetch = require('node-fetch');

async function truthCommand(sock, message, chatId) {
  try {
    const shizokeys = 'shizo';
    
    // Fetch truth from API
    const res = await fetch(`https://shizoapi.onrender.com/api/texts/truth?apikey=${shizokeys}`);
    
    if (!res.ok) {
      throw new Error('API request failed');
    }
    
    const json = await res.json();
    const apiTruth = json.result;

    // Fallback truths in case API fails
    const fallbackTruths = [
      "Have you ever liked anyone? How long?",
      "If you could make a friend in any group, who would you pick?",
      "What's your biggest fear?",
      "Have you ever liked someone and felt they liked you back?",
      "Have you ever stolen money from family?",
      "What's the name of your friend's ex you secretly liked?",
      "What makes you happy when sad?",
      "Have you experienced unrequited love?",
      "What's your most embarrassing moment?",
      "What's your proudest achievement this year?",
      "What's the weirdest thing you've done when alone?",
      "Have you ever cheated on a test?",
      "What is something you've done that you're ashamed of?",
      "Have you ever been caught lying?",
      "What is your most ridiculous nickname?",
      "If you could switch lives with someone for a day, who would it be?",
      "What's the worst gift you've ever received?",
      "Have you ever shared a secret you promised to keep?",
      "What's your biggest insecurity?",
      "Have you ever broken something and blamed someone else?",
      "What's a secret you've kept from your parents?",
      "What would you do if you had only 24 hours to live?",
      "What's the most trouble you've gotten into at school?",
      "What's the worst date you've ever had?",
      "What's something you've never told your best friend?",
      "What's a talent you wish you had?",
      "Have you ever pretended to be sick to skip school?",
      "If you had to date someone in this room, who would it be?",
      "What's a lie you've told to impress someone?",
      "Have you ever stalked someone on social media?",
      "If you had a superpower, what would it be?",
      "Have you ever cried watching a movie? Which one?",
      "What's the most childish thing you still do?",
      "Have you ever laughed at something inappropriate?",
      "What's your guilty pleasure?",
      "If you were invisible, what's the first thing you'd do?",
      "Have you ever lied to get out of trouble?",
      "Who do you admire the most, and why?",
      "What's the meanest thing you've done to someone?",
      "Do you have any hidden talents?",
      "Have you ever lied in a game of Truth or Dare?",
      "What's one secret you've kept from everyone?",
      "Have you ever had a crush on a teacher?",
      "What's the silliest thing you're afraid of?",
      "What's the worst thing you've done when you were mad?",
      "Who was your first kiss?",
      "Have you ever cheated in a relationship?",
      "What's the most expensive thing you've broken?",
      "What's the worst rumor you spread or heard?",
      "Have you ever been jealous of a friend?",
      "What's something you regret doing or saying?"
    ];

    // Use API truth or fallback to random truth
    const selectedTruth = apiTruth || fallbackTruths[Math.floor(Math.random() * fallbackTruths.length)];

    // Random image URLs for variety
    const randomImages = [
      'https://i.ibb.co/305yt26/bf84f20635dedd5dde31e7e5b6983ae9.jpg',
      'https://i.ibb.co/0Q8L7Z2/truth1.jpg',
      'https://i.ibb.co/7Yq3Y6R/truth2.jpg',
      'https://i.ibb.co/4Z0LQ5t/truth3.jpg',
      'https://i.ibb.co/0jH5L2R/truth4.jpg'
    ];

    // Select random image
    const selectedImage = randomImages[Math.floor(Math.random() * randomImages.length)];

    // Send the truth message with image
    const truthMessage = `🎭 *Truth* Challenge 🎭\n\n${selectedTruth}`;

    await sock.sendMessage(chatId, {
      image: { url: selectedImage },
      caption: truthMessage,
      footer: 'June-x'
    }, { quoted: message });

  } catch (error) {
    console.error('Error in truth command:', error);
    
e you ever been caught lying?"
    ];
    
    const fallbackTruth = fallbackTruths[Math.floor(Math.random() * fallbackTruths.length)];
    const fallbackImage = 'https://i.ibb.co/305yt26/bf84f20635dedd5dde31e7e5b6983ae9.jpg';
    
    await sock.sendMessage(chatId, {
      image: { url: fallbackImage },
      caption: `🎭 *Truth* Challenge 🎭\n\n${fallbackTruth}\n\n⚠️ Using fallback mode`,
      footer: 'XLICON-V4-MD'
    }, { quoted: message });
  }
}

module.exports = truthCommand;
