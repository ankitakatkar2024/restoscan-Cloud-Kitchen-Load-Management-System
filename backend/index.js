const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// ---- 1. INITIALIZE DATABASE ----
const db = require('./config/db'); 

// ✅ FIX: Make Redis Optional (Prevents Server Crash on Cloud)
try {
    require('./config/redis'); 
    console.log("✅ Redis config loaded.");
} catch (error) {
    console.log("⚠️ Redis not loaded (Running in Database-Only Mode).");
}

// ---- 2. IMPORT ROUTES ----
const menuRoutes = require('./routes/menuRoutes');
const authRoutes = require('./routes/authRoutes');
const stationRoutes = require('./routes/stationRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const server = http.createServer(app);

// ---- 3. MIDDLEWARE ----
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json());

// ---- 4. SOCKET.IO SETUP ----
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// 🔑 Make Socket.io available in Controllers
app.set('socketio', io);

// Socket Event Listeners
io.on('connection', (socket) => {
  console.log('🟢 Socket connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected:', socket.id);
  });
});

// ---- 5. API ROUTES ----
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/orders', orderRoutes);

// ---- 6. ✅ NEW: SYSTEM RESET ROUTE ----
// This is the route your "Reset System" button calls!
app.post('/api/reset-system', async (req, res) => {
    try {
        console.log("⚠️ RESETTING SYSTEM...");

        // 1. Clear MySQL Tables
        // Disable Foreign Key Checks to allow truncation
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE order_items');
        await db.query('TRUNCATE TABLE orders');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        // 2. Clear Redis (If active)
        try {
            const redisClient = require('./config/redis');
            if (redisClient && redisClient.isOpen) {
                await redisClient.flushAll();
                console.log("🧹 Redis Cache Cleared.");
            }
        } catch (e) {
            console.log("ℹ️ Redis skipped during reset.");
        }

        console.log("✅ SYSTEM RESET COMPLETE");
        
        // Notify all clients to refresh their screens
        io.emit('system_reset', { message: 'System was reset' });

        res.json({ success: true, message: "Database Wiped & System Reset!" });

    } catch (err) {
        console.error("Reset Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ---- 7. HEALTH CHECK ----
app.get('/', (req, res) => {
    res.send('✅ RestoScan Backend is Running...');
});

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'OK', message: 'Server & DB Healthy' });
  } catch (err) {
    console.error("Health Check Failed:", err);
    res.status(500).json({ status: 'DB_ERROR', error: err.message });
  }
});

// ---- 8. START SERVER ----
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on Port ${PORT}`);
});