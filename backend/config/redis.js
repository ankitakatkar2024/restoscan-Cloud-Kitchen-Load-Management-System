const redis = require('redis');

// Create a client to talk to Redis
const client = redis.createClient();

client.on('error', (err) => console.log('Redis Client Error', err));
client.on('connect', () => console.log('Redis Client Connected...'));

// Connect immediately
(async () => {
    await client.connect();
})();

module.exports = client;