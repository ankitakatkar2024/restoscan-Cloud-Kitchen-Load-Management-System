const db = require('../config/db');

// 1. Get All Items
exports.getMenu = async (req, res) => {
    try {
        // Fetch everything so Admin can see it.
        // Frontend can filter if needed, but this prevents "missing column" errors.
        const [items] = await db.query('SELECT * FROM menu_items');
        res.json(items);
    } catch (err) {
        console.error("Menu Fetch Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 2. Add New Item
exports.addMenuItem = async (req, res) => {
    const { name, price, category, is_veg, image_url } = req.body;

    try {
        const [result] = await db.query(
            `INSERT INTO menu_items 
             (name, price, category, is_veg, image_url, is_available, station_id) 
             VALUES (?, ?, ?, ?, ?, 1, 1)`,
            [name, price, category, is_veg ? 1 : 0, image_url]
        );

        res.status(201).json({
            success: true,
            id: result.insertId
        });
    } catch (err) {
        console.error("Add Item Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 3. Update Item
exports.updateMenuItem = async (req, res) => {
    const { id } = req.params;
    const { name, price, category, is_veg, image_url } = req.body;

    try {
        await db.query(
            `UPDATE menu_items 
             SET name = ?, price = ?, category = ?, is_veg = ?, image_url = ?
             WHERE id = ?`,
            [name, price, category, is_veg ? 1 : 0, image_url, id]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 4. Delete Item (Soft Delete)
exports.deleteMenuItem = async (req, res) => {
    const { id } = req.params;

    try {
        await db.query(
            'UPDATE menu_items SET is_available = 0 WHERE id = ?',
            [id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};