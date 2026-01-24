const db = require('./config/db');

const setup = async () => {
  try {
    console.log('🛠️ Setting up menu_items table...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        is_veg TINYINT(1) DEFAULT 1,
        image_url VARCHAR(500),
        station_id INT DEFAULT 1,
        is_available TINYINT(1) DEFAULT 1
      )
    `);

    console.log('✅ menu_items table ready.');

    const [rows] = await db.query('SELECT COUNT(*) AS count FROM menu_items');

    if (rows[0].count === 0) {
      await db.query(
        `INSERT INTO menu_items 
         (name, price, category, is_veg, image_url, station_id)
         VALUES ?`,
        [[
          ['Masala Dosa', 10.00, 'Breakfast', 1, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc', 1],
          ['Butter Chicken', 18.00, 'Mains', 0, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398', 1]
        ]]
      );

      console.log('🍽️ Default menu items inserted.');
    }

    process.exit();
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
};

setup();
