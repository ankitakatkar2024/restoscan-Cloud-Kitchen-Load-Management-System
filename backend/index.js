const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // ✅ Required for SPA routing
require('dotenv').config();

// ---- 1. INITIALIZE DATABASE ----
const db = require('./config/db'); 

// ✅ Redis is optional to prevent cloud crashes
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
    origin: '*', 
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

app.set('socketio', io);

io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    // ✅ Listen for remote table changes from QR Factory
    socket.on('force_table_change', (data) => {
        io.emit('force_table_change', data);
    });

    socket.on('disconnect', () => {
        console.log('🔴 Socket disconnected:', socket.id);
    });
});

// ---- 5. API ROUTES ----
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/orders', orderRoutes);

// ---- 6. SYSTEM RESET ROUTE ----
app.post('/api/reset-system', async (req, res) => {
    try {
        console.log("⚠️ RESETTING SYSTEM...");
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE order_items');
        await db.query('TRUNCATE TABLE orders');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        try {
            const redisClient = require('./config/redis');
            if (redisClient && redisClient.isOpen) {
                await redisClient.flushAll();
                console.log("🧹 Redis Cache Cleared.");
            }
        } catch (e) {
            console.log("ℹ️ Redis skipped during reset.");
        }

        io.emit('system_reset', { message: 'System was reset' });
        res.json({ success: true, message: "Database Wiped & System Reset!" });
    } catch (err) {
        console.error("Reset Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ---- 7. ✅ CRITICAL FIX: SPA ROUTING & STATIC FILES ----
// 1. Tell Express where your frontend build folder is located.
// Change 'dist' to 'build' if you are not using Vite.
const buildPath = path.join(__dirname, '../client/dist'); 
app.use(express.static(buildPath));

// 2. "Catch-All" route: Any URL that is NOT an API call is sent to index.html
// ✅ This is the correct syntax for catch-all routes now
app.get('(.*)', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(buildPath, 'index.html'));
    }
});

// ---- 8. HEALTH CHECK ----
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'OK', message: 'Server & DB Healthy' });
    } catch (err) {
        console.error("Health Check Failed:", err);
        res.status(500).json({ status: 'DB_ERROR', error: err.message });
    }
});

// ---- 9. START SERVER ----
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on Port ${PORT}`);
});