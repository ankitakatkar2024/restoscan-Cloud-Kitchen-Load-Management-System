const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', // ✅ Host from screenshot
    user: '2CLMWxxS7k1yDMA.root',                            // ✅ User from screenshot
    password: 'YzCBRTiDnyz4PF68',                            // ✅ Password from screenshot
    database: 'restoscan_db',                                // We will create this next
    port: 4000,                                              // TiDB uses port 4000
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;