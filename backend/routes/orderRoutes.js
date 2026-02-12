const express = require('express');
const router = express.Router();

const {
  createOrder,
  getActiveOrders,
  updateOrderStatus,
  getSalesStats,
  confirmPayment,
  getOrderHistory,
  requestPayment
} = require('../controllers/orderController');

// Safety check
if (
  typeof createOrder !== 'function' ||
  typeof getActiveOrders !== 'function' ||
  typeof updateOrderStatus !== 'function' ||
  typeof getSalesStats !== 'function' ||
  typeof confirmPayment !== 'function' ||
  typeof getOrderHistory !== 'function' ||
  typeof requestPayment !== 'function'
) {
  console.error('❌ orderController exports broken');
  throw new Error('orderController exports broken');
}

// Routes
router.post('/', createOrder);
router.get('/active', getActiveOrders);
router.get('/stats', getSalesStats);
router.get('/history', getOrderHistory);

router.put('/:id/status', updateOrderStatus);
router.put('/:id/pay', confirmPayment);
router.put('/:id/request-payment', requestPayment);

module.exports = router;
