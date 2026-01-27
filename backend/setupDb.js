// backend/config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// ✅ THIS FILE ONLY CONNECTS. IT DOES NOT CREATE TABLES.
const db = mysql.createPool({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    user: '2CLMWxxS7k1yDMA.root',
    password: 'YzCBRTiDnyz4PF68',
    database: 'restoscan_db',
    port: 4000,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;