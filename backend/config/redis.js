const redis = require('redis');
require('dotenv').config();

// Configuration: Use the Cloud URL if available, otherwise fallback to Localhost
const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

// Event Listeners to see what's happening in the logs
client.on('error', (err) => console.log('❌ Redis Client Error:', err));
client.on('connect', () => console.log('✅ Redis Client Connected Successfully...'));

// Connect immediately
(async () => {
    try {
        await client.connect();
    } catch (error) {
        console.error("❌ Fatal Error: Could not connect to Redis. Check REDIS_URL.", error);
    }
})();

module.exports = client;