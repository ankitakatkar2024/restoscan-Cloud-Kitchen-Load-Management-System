const mysql = require('mysql2');
require('dotenv').config(); // Load the password from .env

// Create the connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert to promise-based pool (modern JS)
const promisePool = pool.promise();

console.log("MySQL Pool Configuration Loaded...");

module.exports = promisePool;