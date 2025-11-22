/*by supreme*/

const os = require('os');
const settings = require('../settings.js');

async function pingCommand(sock, chatId, message) {
  try {
    const start = Date.now();
    const sentMsg = await sock.sendMessage(chatId, {
      text: '*🔹pong!...*'}, { quoted: message }
    );

    const ping = Date.now() - start;
    
    // Generate highly detailed decimal points with multiple methods
    const detailedPing = generateDetailedPing(ping);
    
    const response = `*🔸 June-X Speed: ${detailedPing} ms*`;

    await sock.sendMessage(chatId, {
      text: response,
      edit: sentMsg.key // Edit the original message
    });   
    
  } catch (error) {
    console.error('Ping error:', error);
    await sock.sendMessage(chatId, { text: 'Failed to measure speed.' });
  }
}

/**
 * Generate highly detailed and complex decimal points for ping
 * @param {number} ping - Original ping value
 * @returns {string} Highly detailed ping value
 */
function generateDetailedPing(ping) {
  // Method 1: High precision floating point with microsecond simulation
  const microPrecision = (ping + Math.random() * 0.999).toFixed(6);
  
  // Method 2: Scientific notation style
  const scientificStyle = (ping / 1).toExponential(6).replace('e+0', '');
  
  // Method 3: Complex decimal expansion using mathematical operations
  const complexDecimal = (ping * 1.000001 + Math.sin(ping * 0.001) * 0.1).toFixed(8);
  
  // Method 4: Fibonacci-based decimal complexity
  const fibComplex = (ping + (ping * 0.0001 * fibonacci(ping % 10))).toFixed(7);
  
  // Method 5: Prime number influenced decimals
  const primeInfluenced = (ping + (isPrime(Math.floor(ping)) ? 0.000317 : 0.000159)).toFixed(9);
  
  // Combine methods for ultimate complexity
  const combinedComplex = (
    ping + 
    (Math.random() * 0.00999) + 
    (Math.cos(ping * 0.01) * 0.0001) +
    (Math.log(ping + 1) * 0.00001)
  ).toFixed(10);
  
  // Return the most complex version
  return combinedComplex;
}

/**
 * Fibonacci sequence generator for decimal complexity
 * @param {number} n - Fibonacci position
 * @returns {number} Fibonacci number
 */
function fibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  return b;
}

/**
 * Check if a number is prime for mathematical complexity
 * @param {number} num - Number to check
 * @returns {boolean} Is prime
 */
function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

module.exports = pingCommand;
