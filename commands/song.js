
//new song API 

const yts = require('yt-search');
const axios = require('axios');

async function songCommand(sock, chatId, message) {
    
    
    
    try {
         await sock.sendMessage(chatId, {
            react: {
                text: "🎵",
                key: message.key
            }
        });
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
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
        const fake = createFakeContact(message);
        
        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What song do you want to download?"},{ quoted: message
            });
        }

        // Search for the song
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "No songs found!"
            });
        }

        

        // Get the first video result
        const video = videos[0];
        const urlYt = video.url;

        // Fetch audio data from API
        const response = await axios.get(`https://api.privatezia.biz.id/api/downloader/ytmp3?url=${urlYt}`);
        const apiData = response.data;

        if (!apiData || !apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to fetch audio from the API. Please try again later."},{ quoted: fake
            });
        }

        const audioUrl = apiData.result.downloadUrl;
        const title = apiData.result.title;
        
       await sock.sendMessage(chatId, { text: `_🎶 Playing song: *${apiData.result.title}* 🎧_` }, { quoted: fake });
        //time out
     //  const audioResponse = await axios({ method: "get", url: apiData.result.downloadUrl, responseType: "stream", timeout: 6000 });


        
        // Send the audio
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: fake });
        
        //successful react ✔️
       await sock.sendMessage(chatId, { react: { text: '💅', key: message.key } 
        });
       

    } catch (error) {
        console.error('Error in song2 command:', error);
        await sock.sendMessage(chatId, { 
            text: "Download failed. Please try again later."
        }, { quoted: fake});
        
        //err react ❌
            await sock.sendMessage(chatId, {
            react: { text: '🚫', key: message.key }
        });
    }
}

module.exports = songCommand; 








