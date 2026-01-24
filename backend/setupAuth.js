const db = require('./config/db');

const setupAuth = async () => {
    try {
        console.log("🔐 Setting up Auth System...");

        // 1. Create the 'users' table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'manager' 
            )
        `);
        console.log("✅ Table 'users' ready.");

        // 2. Insert a Default Admin (if empty)
        // NOTE: In a real app, we verify passwords with Encryption (bcrypt). 
        // For now, we will store plain text to keep it simple for you to learn.
        const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
        if (rows[0].count === 0) {
            await db.query(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                ['admin', 'securePass123', 'owner']
            );
            await db.query(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                ['manager1', 'citybranch1', 'manager']
            );
            console.log("👤 Default users created: 'admin' and 'manager1'");
        } else {
            console.log("ℹ️ Users already exist.");
        }

        process.exit();
    } catch (err) {
        console.error("❌ Error setting up Auth:", err);
        process.exit(1);
    }
};

setupAuth();