const db = require('../config/db');
const redisClient = require('../config/redis');

// ✅ UPDATED: Logging the high limit for confirmation
console.log('MAX_STATION_LOAD =', process.env.MAX_STATION_LOAD || 1000);

/* ================================
   1. CREATE ORDER (SAFE VERSION)
================================ */

exports.createOrder = async (req, res) => {
  const { customer_name, items } = req.body;

  if (!customer_name)
    return res.status(400).json({ error: 'Customer name required' });

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Order must have items' });

  // ✅ PERMANENT FIX: Hardcoded limit to 1000 to prevent blocking
  const MAX_LOAD = 1000;
  
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    /* STEP 1 — FETCH REAL DB ITEMS */
    const itemIds = items.map(i => i.id);

    const [dbItems] = await connection.query(
      'SELECT id, name, price, station_id FROM menu_items WHERE id IN (?)',
      [itemIds]
    );

    const itemMap = {};
    dbItems.forEach(i => (itemMap[i.id] = i));

    /* STEP 2 — AGGREGATE LOAD FROM DB ONLY */
    const stationTotals = {};

    for (const item of items) {
      const dbItem = itemMap[item.id];
      if (!dbItem) throw new Error(`Invalid item ${item.id}`);

      const station = dbItem.station_id;
      stationTotals[station] =
        (stationTotals[station] || 0) + item.quantity;
    }

    /* STEP 3 — CHECK REDIS LOAD (Logic Kept but Limit is 1000) */
    try {
        if (redisClient && redisClient.isOpen) {
            for (const stationId in stationTotals) {
              const key = `station:${stationId}:load`;
              const current = parseInt(await redisClient.get(key), 10) || 0;

              if (current + stationTotals[stationId] > MAX_LOAD) {
                await connection.rollback();
                return res.status(429).json({
                  error: `Kitchen Busy — Station ${stationId}`
                });
              }
            }
        }
    } catch (redisErr) {
        console.warn("⚠️ Redis load check skipped (Connection issue)");
    }

    /* STEP 4 — CALCULATE BILL */
    let subtotal = 0;

    for (const item of items) {
      const dbItem = itemMap[item.id];
      subtotal += dbItem.price * item.quantity;
    }

    const gst = subtotal * 0.05;
    const total_price = subtotal + gst;

    /* STEP 5 — INSERT ORDER */
    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (customer_name, subtotal, gst, total_price,
        status, payment_status, payment_method)
       VALUES (?, ?, ?, ?, 'PENDING', 'PENDING', NULL)`,
      [customer_name, subtotal, gst, total_price]
    );

    const orderId = orderResult.insertId;

    /* STEP 6 — INSERT ITEMS + UPDATE REDIS */
    const normalizedItems = [];

    for (const item of items) {
      const dbItem = itemMap[item.id];

      await connection.query(
        `INSERT INTO order_items
         (order_id, item_id, item_name,
          price, quantity, station_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          dbItem.id,
          dbItem.name,
          dbItem.price,
          item.quantity,
          dbItem.station_id
        ]
      );

      // Update Redis Load
      try {
          if (redisClient && redisClient.isOpen) {
              const key = `station:${dbItem.station_id}:load`;
              await redisClient.incrBy(key, item.quantity);
              const load = parseInt(await redisClient.get(key), 10) || 0;

              req.app.get('socketio').emit('station_load_update', {
                stationId: dbItem.station_id,
                currentLoad: load,
                maxLoad: MAX_LOAD
              });
          }
      } catch (e) { /* Ignore Redis errors on update */ }

      normalizedItems.push({
        id: dbItem.id,
        name: dbItem.name,
        qty: item.quantity,
        station_id: dbItem.station_id
      });
    }

    await connection.commit();

    /* STEP 7 — SOCKET ORDER EMIT */
    req.app.get('socketio').emit('order_created', {
      id: orderId,
      customer_name,
      items: normalizedItems,
      total_price
    });

    res.status(201).json({
      success: true, // ✅ Added success flag for frontend check
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

/* ================================
   2. GET ACTIVE ORDERS
================================ */
exports.getActiveOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT id, customer_name, status,
              payment_status, payment_method,
              created_at
       FROM orders
       WHERE status != 'COMPLETED'
       ORDER BY created_at DESC`
    );

    for (const order of orders) {
      const [items] = await db.query(
        `SELECT item_id, item_name,
                quantity, station_id
         FROM order_items
         WHERE order_id = ?`,
        [order.id]
      );

      order.items = items.map(i => ({
        id: i.item_id,
        name: i.item_name,
        qty: i.quantity,
        station_id: i.station_id
      }));
    }

    res.json(orders);

  } catch (err) {
    console.error('ACTIVE ORDERS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

/* ================================
   3. UPDATE ORDER STATUS
================================ */
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'Status required' });

  try {
    const [[order]] = await db.query('SELECT payment_status FROM orders WHERE id = ?', [id]);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (status === 'COMPLETED' && order.payment_status !== 'PAID') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    /* RELEASE LOAD ONLY ON COMPLETED */
    if (status === 'COMPLETED') {
      const [items] = await db.query('SELECT station_id, quantity FROM order_items WHERE order_id = ?', [id]);
      const MAX_LOAD = 1000; // ✅ Ensure update matches create limit

      try {
          if (redisClient && redisClient.isOpen) {
              for (const item of items) {
                const key = `station:${item.station_id}:load`;
                await redisClient.decrBy(key, item.quantity);
                let load = parseInt(await redisClient.get(key), 10) || 0;
                if (load < 0) { load = 0; await redisClient.set(key, 0); }

                req.app.get('socketio').emit('station_load_update', {
                  stationId: item.station_id,
                  currentLoad: load,
                  maxLoad: MAX_LOAD
                });
              }
          }
      } catch (e) { /* Ignore Redis errors */ }
    }

    req.app.get('socketio').emit('order_status_updated', { id: Number(id), status });
    res.json({ message: 'Updated' });

  } catch (err) {
    console.error('STATUS UPDATE ERROR:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
};

/* ================================
   4. SALES STATS
================================ */
exports.getSalesStats = async (req, res) => {
  try {
    const [[revenue]] = await db.query('SELECT SUM(total_price) AS revenue, COUNT(*) AS orders FROM orders');
    const [topItems] = await db.query(`SELECT item_name, SUM(quantity) AS sold FROM order_items GROUP BY item_name ORDER BY sold DESC LIMIT 5`);
    res.json({ revenue: revenue.revenue || 0, orders: revenue.orders || 0, topItems });
  } catch (err) {
    console.error('STATS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

/* ================================
   5. CONFIRM PAYMENT
================================ */
exports.confirmPayment = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE orders SET payment_status='PAID', paid_at=NOW() WHERE id=?", [id]);
    req.app.get('socketio').emit('payment_updated', { id: Number(id), payment_status: 'PAID' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Payment failed' });
  }
};

/* ================================
   6. ORDER HISTORY
================================ */
exports.getOrderHistory = async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    // Basic item fetch loop to satisfy frontend structure
    for (const order of orders) {
       const [items] = await db.query('SELECT item_name as name, quantity, price FROM order_items WHERE order_id = ?', [order.id]);
       order.items = items;
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

/* ================================
   7. REQUEST PAYMENT
================================ */
exports.requestPayment = async (req, res) => {
  const { id } = req.params;
  const { method } = req.body;
  try {
    await db.query('UPDATE orders SET payment_method = ? WHERE id = ?', [method, id]);
    req.app.get('socketio').emit('payment_updated', { id: Number(id), payment_method: method });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
};