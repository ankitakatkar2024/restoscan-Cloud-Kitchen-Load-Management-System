const express = require('express');
const router = express.Router();

// 1. Import ALL controller functions
const {
  createOrder,
  getActiveOrders,
  updateOrderStatus,
  getSalesStats,
  confirmPayment,
  getOrderHistory, 
  requestPayment   
} = require('../controllers/orderController');

// 🔒 2. Safety Check
if (
  typeof createOrder !== 'function' ||
  typeof getActiveOrders !== 'function' ||
  typeof updateOrderStatus !== 'function' ||
  typeof getSalesStats !== 'function' ||
  typeof confirmPayment !== 'function' ||
  typeof getOrderHistory !== 'function' ||
  typeof requestPayment !== 'function'
) {
  console.error("❌ CRITICAL ERROR: One or more orderController functions are missing!");
  throw new Error('❌ orderController exports are broken');
}

// ---- ROUTES ----

// 3. Static GET Routes
router.post('/', createOrder);                 
router.get('/active', getActiveOrders);        
router.get('/stats', getSalesStats);           
router.get('/history', getOrderHistory);       

// 4. Dynamic Routes
router.put('/:id/status', updateOrderStatus);  
router.put('/:id/pay', confirmPayment);        

// ✅ FIX: Renamed from 'pay-request' to 'request-payment' to match Frontend
router.put('/:id/request-payment', requestPayment); 

module.exports = router;