const db = require('../config/db');

exports.getAllStations = async (req, res) => {
    try {
        // Fetch all stations from the database
        const [stations] = await db.query('SELECT * FROM stations');
        res.json(stations);
    } catch (err) {
        console.error("Error fetching stations:", err);
        res.status(500).json({ error: err.message });
    }
};