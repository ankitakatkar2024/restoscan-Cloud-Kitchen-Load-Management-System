const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// ---- SERVICES (INITIALIZE FIRST) ----
const db = require('./config/db');     // ✅ FIXED: Assigned to 'db' variable
require('./config/redis');     // Redis client init

// ---- ROUTES ----
const menuRoutes = require('./routes/menuRoutes');
const authRoutes = require('./routes/authRoutes');
const stationRoutes = require('./routes/stationRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();

// ---- MIDDLEWARE ----
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json());

// ---- HTTP SERVER ----
const server = http.createServer(app);

// ---- SOCKET.IO ----
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// 🔑 MAKE SOCKET AVAILABLE EVERYWHERE
app.set('socketio', io);

// ---- SOCKET EVENTS ----
io.on('connection', (socket) => {
  console.log('🟢 Socket connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected:', socket.id);
  });
});

// ==========================================
// ✅ NEW FEATURE: UPDATE STATUS + PREP TIME
// We place this BEFORE 'orderRoutes' to ensure it handles the update logic
// ==========================================
app.put('/api/orders/:id', async (req, res) => {
  const { status, prep_time } = req.body; 
  const id = parseInt(req.params.id);

  try {
    if (prep_time) {
        // If Chef sets time, update both status and time
        await db.query('UPDATE orders SET status = ?, prep_time = ? WHERE id = ?', [status, prep_time, id]);
    } else {
        // Normal status update (e.g. marking READY or COMPLETED)
        await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    }
    
    // Notify Customer via Socket (Send prep_time too!)
    io.emit('order_status_updated', { id, status, prep_time });
    
    res.json({ message: 'Status updated' });
  } catch (err) { 
    console.error("Update Error:", err);
    res.status(500).json({ error: err.message }); 
  }
});

// ---- API ROUTES ----
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/orders', orderRoutes);

// ---- HEALTH CHECK ----
app.get('/health', async (req, res) => {
  try {
    const db = require('./config/db');
    await db.query('SELECT 1');
    res.json({ status: 'OK' });
  } catch (err) {
    res.status(500).json({ status: 'DB_ERROR', error: err.message });
  }
});

// ---- START SERVER ----
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
