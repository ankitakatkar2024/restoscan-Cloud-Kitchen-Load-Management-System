const express = require('express');
const router = express.Router();
const { getAllStations } = require('../controllers/stationController');

// When someone visits this route, run the logic we wrote in Step 1
router.get('/', getAllStations);

module.exports = router;