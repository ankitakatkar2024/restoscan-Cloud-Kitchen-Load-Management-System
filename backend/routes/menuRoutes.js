const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

router.get('/', menuController.getMenu);
router.post('/', menuController.addMenuItem);
router.delete('/:id', menuController.deleteMenuItem);
router.put('/:id', menuController.updateMenuItem); // <--- NEW: Enable Editing

module.exports = router;