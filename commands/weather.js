const axios = require('axios');

module.exports = async function (sock, chatId, city) {
    try {
        if (!city || city.trim().length < 2) {
            await sock.sendMessage(chatId, { text: "🌍 Please provide a valid city or town name (at least 2 characters)!" });
            return;
        }

        const apiKey = '1ad47ec6172f19dfaf89eb3307f74785';  // Your existing API key
        const encodedCity = encodeURIComponent(city.trim());
        
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodedCity}&appid=${apiKey}&units=metric`
        );
        
        const data = response.data;
        
        if (data.cod !== 200) {
            let errorMsg = "❌ Unable to find that location. Please check the spelling.";
            if (data.cod === 404) errorMsg = "❌ City not found. Please check the spelling.";
            if (data.cod === 401) errorMsg = "❌ Weather service configuration error.";
            await sock.sendMessage(chatId, { text: errorMsg });
            return;
        }

        const weatherText = `
🌤️ *Weather Report for ${data.name}*
🌡️ Temperature: ${Math.round(data.main.temp)}°C
🌬️ Feels Like: ${Math.round(data.main.feels_like)}°C
🌧️ Rain Volume: ${data.rain?.['1h'] || 0} mm
☁️ Cloudiness: ${data.clouds.all}%
💧 Humidity: ${data.main.humidity}%
🌪️ Wind Speed: ${data.wind.speed} m/s
📝 Condition: ${data.weather[0].description}
🌄 Sunrise: ${new Date(data.sys.sunrise * 1000).toLocaleTimeString()}
🌅 Sunset: ${new Date(data.sys.sunset * 1000).toLocaleTimeString()}
`;
        
        await sock.sendMessage(chatId, { text: weatherText });
        
    } catch (error) {
        console.error('Error fetching weather:', error);
        
        let errorMessage = '❌ Unable to retrieve weather information.';
        if (error.response) {
            if (error.response.status === 404) {
                errorMessage = '❌ City not found. Please check the spelling.';
            } else if (error.response.status === 401) {
                errorMessage = '❌ Weather service configuration error.';
            } else if (error.response.status === 429) {
                errorMessage = '❌ Too many requests. Please try again later.';
            }
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = '❌ Network error. Please check your internet connection.';
        }
        
        await sock.sendMessage(chatId, { text: errorMessage });
    }
};
