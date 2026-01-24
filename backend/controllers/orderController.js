const db = require('../config/db');
const redisClient = require('../config/redis');

console.log('MAX_STATION_LOAD =', process.env.MAX_STATION_LOAD);

/**
 * 1. CREATE ORDER (LOAD SAFE + BILLING SAFE)
 */
exports.createOrder = async (req, res) => {
  const { customer_name, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must have items' });
  }

  const MAX_LOAD_PER_STATION = parseInt(process.env.MAX_STATION_LOAD, 10) || 20;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // STEP 1 — AGGREGATE LOAD PER STATION
    const stationTotals = {};
    for (const item of items) {
      stationTotals[item.station_id] = (stationTotals[item.station_id] || 0) + item.quantity;
    }

    // STEP 2 — CHECK REDIS LOAD
    for (const stationId in stationTotals) {
      const redisKey = `station:${stationId}:load`;
      const currentLoad = parseInt(await redisClient.get(redisKey), 10) || 0;

      if (currentLoad + stationTotals[stationId] > MAX_LOAD_PER_STATION) {
        await connection.rollback();
        return res.status(429).json({
          error: `Kitchen Busy! Station ${stationId} overloaded`
        });
      }
    }

    // STEP 3 — FETCH PRICES FROM DB
    const itemIds = items.map(i => i.id);
    const [dbItems] = await connection.query(
      'SELECT id, name, price FROM menu_items WHERE id IN (?)',
      [itemIds]
    );

    const priceMap = {};
    for (const item of dbItems) {
      priceMap[item.id] = item;
    }

    // STEP 4 — CALCULATE BILL
    let subtotal = 0;
    for (const item of items) {
      const dbItem = priceMap[item.id];
      if (!dbItem) throw new Error(`Invalid item id ${item.id}`);
      subtotal += dbItem.price * item.quantity;
    }

    const gst = subtotal * 0.05;
    const total_price = subtotal + gst;

    // STEP 5 — INSERT ORDER
    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (customer_name, subtotal, gst, total_price, status, payment_status, payment_method)
       VALUES (?, ?, ?, ?, 'PENDING', 'PENDING', NULL)`,
      [customer_name, subtotal, gst, total_price]
    );

    const orderId = orderResult.insertId;

    // STEP 6 — INSERT ITEMS + UPDATE REDIS
    for (const item of items) {
      const dbItem = priceMap[item.id];

      await connection.query(
        `INSERT INTO order_items
         (order_id, item_id, item_name, price, quantity, station_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          dbItem.id,
          dbItem.name,
          dbItem.price,
          item.quantity,
          item.station_id
        ]
      );

      const redisKey = `station:${item.station_id}:load`;
      await redisClient.incrBy(redisKey, item.quantity);

      const currentLoad = await redisClient.get(redisKey);
      req.app.get('socketio').emit('station_load_update', {
        stationId: item.station_id,
        currentLoad: Number(currentLoad),
        maxLoad: MAX_LOAD_PER_STATION
      });
    }

    await connection.commit();

    // ✅ FIXED: Send full details so the Screen can display it instantly!
    req.app.get('socketio').emit('order_created', { 
        id: orderId, 
        customer_name, 
        items, 
        total_price 
    });

    res.status(201).json({
      order: {
        id: orderId,
        subtotal,
        gst,
        total: total_price,
        status: 'PENDING'
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('CREATE ORDER ERROR:', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    connection.release();
  }
};

/**
 * 2. GET ACTIVE ORDERS — ✅ NORMALIZED
 */
exports.getActiveOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT id,
              customer_name,
              status,
              payment_status,
              payment_method,
              created_at
       FROM orders
       WHERE status != 'COMPLETED'
       ORDER BY created_at DESC`
    );

    for (const order of orders) {
      const [items] = await db.query(
        `SELECT item_id, item_name, quantity, station_id
         FROM order_items
         WHERE order_id = ?`,
        [order.id]
      );

      order.items = (items || []).map(i => ({
        id: i.item_id,
        name: i.item_name,
        qty: i.quantity,
        station_id: i.station_id
      }));
    }

    res.json(orders);
  } catch (err) {
    console.error('GET ACTIVE ORDERS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

/**
 * 3. UPDATE ORDER STATUS (PAYMENT-SAFE)
 */
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    // 1. FETCH ORDER FIRST (MANDATORY)
    const [[order]] = await db.query(
      `SELECT id, status, payment_status
       FROM orders
       WHERE id = ?`,
      [id]
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // 🔒 BLOCK COMPLETION IF UNPAID (NON-NEGOTIABLE)
    if (status === 'COMPLETED' && order.payment_status !== 'PAID') {
      return res.status(400).json({
        error: 'Payment not completed'
      });
    }

    // 2. UPDATE STATUS
    const [result] = await db.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // 3. RELEASE STATION LOAD IF COMPLETED
    if (status === 'COMPLETED') {
      const [items] = await db.query(
        'SELECT station_id, quantity FROM order_items WHERE order_id = ?',
        [id]
      );

      for (const item of items) {
        const redisKey = `station:${item.station_id}:load`;
        await redisClient.decrBy(redisKey, item.quantity);

        const currentLoad = await redisClient.get(redisKey);
        req.app.get('socketio').emit('station_load_update', {
          stationId: item.station_id,
          currentLoad: Number(currentLoad),
          maxLoad: parseInt(process.env.MAX_STATION_LOAD, 10) || 20
        });
      }
    }

    // 4. EMIT STATUS UPDATE
    req.app.get('socketio').emit('order_status_updated', {
      id: Number(id),
      status
    });

    res.json({ message: 'Status updated' });

  } catch (err) {
    console.error('UPDATE STATUS ERROR:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

/**
 * 4. SALES STATS
 */
exports.getSalesStats = async (req, res) => {
  try {
    const [[revenue]] = await db.query(
      'SELECT SUM(total_price) AS revenue, COUNT(*) AS orders FROM orders'
    );

    const [topItems] = await db.query(`
      SELECT item_name, SUM(quantity) AS sold
      FROM order_items
      GROUP BY item_name
      ORDER BY sold DESC
      LIMIT 5
    `);

    res.json({
      revenue: revenue.revenue || 0,
      orders: revenue.orders || 0,
      topItems
    });
  } catch (err) {
    console.error('STATS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

/**
 * 5. CONFIRM PAYMENT (Called by Admin to verify money received)
 */
exports.confirmPayment = async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[order]] = await connection.query(
      `SELECT id, status, payment_status
       FROM orders
       WHERE id = ?`,
      [id]
    );

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.payment_status === 'PAID') {
      await connection.rollback();
      return res.status(400).json({
        error: 'Payment already processed'
      });
    }

    await connection.query(
      `UPDATE orders
       SET payment_status = 'PAID',
           paid_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await connection.commit();

    // Notify Frontend (Customer & Admin) that payment is done
    req.app.get('socketio').emit('payment_updated', {
      id: Number(id),
      payment_status: 'PAID'
    });

    res.json({ message: 'Payment confirmed' });

  } catch (err) {
    await connection.rollback();
    console.error('PAYMENT CONFIRM ERROR:', err);
    res.status(500).json({ error: 'Failed to confirm payment' });
  } finally {
    connection.release();
  }
};

/**
 * 6. GET ORDER HISTORY (FOR ADMIN DASHBOARD)
 */
exports.getOrderHistory = async (req, res) => {
  try {
    // 1. Fetch all orders (completed & pending)
    const [orders] = await db.query(
      `SELECT id, total_price, customer_name, status, created_at, payment_status, payment_method
       FROM orders 
       ORDER BY created_at DESC`
    );

    // 2. Attach items to each order (needed for Category/Top Item stats)
    for (const order of orders) {
      const [items] = await db.query(
        `SELECT item_name as name, quantity, price 
         FROM order_items 
         WHERE order_id = ?`,
        [order.id]
      );
      order.items = items; // Attach items array
    }

    res.json(orders);
  } catch (err) {
    console.error('HISTORY ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

/**
 * 7. REQUEST PAYMENT METHOD (Called by Customer)
 * Updates the DB with the user's choice (Cash vs UPI) so Manager knows what to verify.
 */
exports.requestPayment = async (req, res) => {
  const { id } = req.params;
  const { method } = req.body; // 'UPI' or 'CASH'

  try {
    // Update the method in DB
    await db.query('UPDATE orders SET payment_method = ? WHERE id = ?', [method, id]);
    
   req.app.get('socketio').emit('payment_updated', { id: Number(id), payment_method: method });
    res.json({ success: true });
  } catch (err) {
    console.error('REQUEST PAYMENT ERROR:', err);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
};