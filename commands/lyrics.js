const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');
const axios = require('axios');

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await sock.sendMessage(chatId, { 
            text: '🔍 Please enter the song name to get the lyrics! Usage: *lyrics <song name>*'
        }, { quoted: message });
        return;
    }

    try {
        // Send initial reaction
        await sock.sendMessage(chatId, { react: { text: "🔍", key: message.key } });

        // Use lyricsapi.fly.dev and return only the raw lyrics text
        const apiUrl = `https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(songTitle)}`;
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText);
        }
        
        const data = await res.json();
        const lyrics = data?.result?.lyrics;
        const songInfo = data?.result;
        
        if (!lyrics) {
            await sock.sendMessage(chatId, {
                text: `❌ Sorry, I couldn't find any lyrics for "${songTitle}".`
            }, { quoted: message });
            return;
        }

        // Get album artwork
        const artworkUrl = await getAlbumArtwork(songTitle, songInfo?.artist || '');
        
        // Process reaction
        await sock.sendMessage(chatId, { react: { text: "📝", key: message.key } });

        const maxChars = 4096;
        const truncatedLyrics = lyrics.length > maxChars ? lyrics.slice(0, maxChars - 3) + '...' : lyrics;

        // Create formatted caption with song info
        const caption = createLyricsCaption(songTitle, songInfo, truncatedLyrics);

        if (artworkUrl) {
            try {
                // Download and optimize the image
                const imageBuffer = await downloadAndProcessImage(artworkUrl);
                
                await sock.sendMessage(chatId, {
                    image: imageBuffer,
                    caption: caption,
                    contextInfo: {
                        externalAdReply: {
                            title: songInfo?.title || songTitle,
                            body: `Artist: ${songInfo?.artist || 'Unknown'} | Lyrics`,
                            mediaType: 1,
                            thumbnailUrl: artworkUrl,
                            sourceUrl: artworkUrl,
                            renderLargerThumbnail: true,
                            showAdAttribution: false
                        }
                    }
                }, { quoted: message });
            } catch (imageError) {
                console.error('Image processing failed, sending text only:', imageError);
                // Fallback to text only if image fails
                await sock.sendMessage(chatId, { 
                    text: caption 
                }, { quoted: message });
            }
        } else {
            // Send without image if no artwork found
            await sock.sendMessage(chatId, { 
                text: caption 
            }, { quoted: message });
        }

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: "🎵", key: message.key } });

    } catch (error) {
        console.error('Error in lyrics command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ An error occurred while fetching the lyrics for "${songTitle}".`
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

async function getAlbumArtwork(songTitle, artist = '') {
    try {
        // Try multiple sources for album artwork
        
        // Source 1: iTunes API
        const itunesQuery = encodeURIComponent(`${songTitle} ${artist}`.trim());
        const itunesUrl = `https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`;
        
        const itunesResponse = await fetch(itunesUrl);
        if (itunesResponse.ok) {
            const itunesData = await itunesResponse.json();
            if (itunesData.results && itunesData.results.length > 0) {
                const artworkUrl = itunesData.results[0].artworkUrl100;
                if (artworkUrl) {
                    // Convert 100x100 to higher resolution (600x600)
                    return artworkUrl.replace('100x100', '600x600');
                }
            }
        }

        // Source 2: Last.fm API (fallback)
        const lastfmQuery = encodeURIComponent(songTitle);
        const lastfmUrl = `http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=YOUR_LASTFM_API_KEY&artist=${encodeURIComponent(artist)}&track=${lastfmQuery}&format=json`;
        
        // Note: You'll need to get a free API key from Last.fm
        // For now, we'll skip this or use a placeholder
        
        // Source 3: Deezer API (alternative)
        const deezerUrl = `https://api.deezer.com/search?q=${itunesQuery}&limit=1`;
        const deezerResponse = await fetch(deezerUrl);
        if (deezerResponse.ok) {
            const deezerData = await deezerResponse.json();
            if (deezerData.data && deezerData.data.length > 0) {
                return deezerData.data[0].album.cover_xl || deezerData.data[0].album.cover_big;
            }
        }

        // Fallback: Use a music-themed placeholder
        return null;
        
    } catch (error) {
        console.error('Error fetching album artwork:', error);
        return null;
    }
}

async function downloadAndProcessImage(imageUrl) {
    try {
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'arraybuffer',
            timeout: 10000
        });

        // Process image with sharp - optimize for WhatsApp
        const processedImage = await sharp(response.data)
            .resize(500, 500, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ 
                quality: 80,
                progressive: true 
            })
            .toBuffer();

        return processedImage;
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}

function createLyricsCaption(songTitle, songInfo, lyrics) {
    const title = songInfo?.title || songTitle;
    const artist = songInfo?.artist || 'Unknown Artist';
    const album = songInfo?.album || 'Unknown Album';
    
    return `🎵 *${title}* - ${artist}
💿 Album: ${album}

📝 *Lyrics:*
${lyrics}

━━━━━━━━━━━━━━━━━━━━
🔍 Search: ${songTitle}
🎶 Powered by Lyrics API`;
}

// Alternative simpler version without external dependencies
async function getSimpleAlbumArtwork(songTitle) {
    // Use a music-themed placeholder image
    const placeholders = [
        'https://i.imgur.com/3Q7Yc7Q.jpeg', // Music notes
        'https://i.imgur.com/5X2L3vR.jpeg', // Headphones
        'https://i.imgur.com/8L9vW3c.jpeg', // Microphone
    ];
    
    return placeholders[Math.floor(Math.random() * placeholders.length)];
}

module.exports = { lyricsCommand };
