// backend/setup_cloud_db.js
const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    user: '2CLMWxxS7k1yDMA.root',
    password: 'YzCBRTiDnyz4PF68',
    database: 'restoscan_db',
    port: 4000,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
};

async function resetDatabase() {
    const connection = await mysql.createConnection(dbConfig);
    console.log("🔥 Connected to Cloud Database...");

    try {
        // 1. DROP OLD TABLES (Clear the broken data)
        console.log("⚠️ Deleting old tables...");
        await connection.query("DROP TABLE IF EXISTS order_items");
        await connection.query("DROP TABLE IF EXISTS orders");
        await connection.query("DROP TABLE IF EXISTS menu_items");
        await connection.query("DROP TABLE IF EXISTS users");

        // 2. CREATE NEW TABLES
        console.log("🏗️ Creating fresh tables...");

        await connection.query(`
            CREATE TABLE menu_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                category VARCHAR(100),
                image_url TEXT,
                is_veg BOOLEAN DEFAULT TRUE,
                station_id INT DEFAULT 1,
                available BOOLEAN DEFAULT TRUE
            )
        `);

        await connection.query(`
            CREATE TABLE orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_name VARCHAR(255),
                subtotal DECIMAL(10,2) DEFAULT 0.00,
                gst DECIMAL(10,2) DEFAULT 0.00,
                total_price DECIMAL(10,2) NOT NULL,
                status ENUM('PENDING', 'PREPARING', 'READY', 'COMPLETED') DEFAULT 'PENDING',
                payment_status ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
                payment_method VARCHAR(50),
                paid_at TIMESTAMP NULL,
                prep_time INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT,
                item_id INT,
                item_name VARCHAR(255),
                price DECIMAL(10,2),
                quantity INT,
                station_id INT,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

        await connection.query(`
            CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'kitchen') DEFAULT 'admin'
            )
        `);

        // 3. INSERT DEFAULT DATA
        console.log("🌱 Adding Menu Items...");
        await connection.query(`
            INSERT INTO menu_items (name, price, category, is_veg, image_url) VALUES 
            ('Masala Dosa', 120, 'Breakfast', 1, 'https://placehold.co/200?text=Dosa'),
            ('Paneer Tikka', 250, 'Starters', 1, 'https://placehold.co/200?text=Paneer'),
            ('Chicken Biryani', 350, 'Mains', 0, 'https://placehold.co/200?text=Biryani'),
            ('Cola', 50, 'Beverages', 1, 'https://placehold.co/200?text=Cola')
        `);

        await connection.query(`INSERT IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')`);

        console.log("✅ DATABASE FIXED SUCCESSFULLY!");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        connection.end();
    }
}

resetDatabase();