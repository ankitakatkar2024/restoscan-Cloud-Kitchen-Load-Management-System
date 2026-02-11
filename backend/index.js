const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// ---- SERVICES (INITIALIZE FIRST) ----
const db = require('./config/db');     // ✅ Database Connection
require('./config/redis');     // Redis client init

// ---- ROUTES (Keep existing imports) ----
const menuRoutes = require('./routes/menuRoutes');
const stationRoutes = require('./routes/stationRoutes');
const orderRoutes = require('./routes/orderRoutes');
// Note: We will handle Auth manually below to support the new Restaurant feature

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
  
  // Optional: Join a specific restaurant room
  socket.on('join_restaurant', (restaurantId) => {
      socket.join(`restaurant_${restaurantId}`);
      console.log(`Socket ${socket.id} joined restaurant ${restaurantId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected:', socket.id);
  });
});

// ==========================================
// 🔐 NEW AUTHENTICATION (Multi-Tenant Support)
// We handle this HERE to support "Restaurant Name"
// ==========================================

// 1. REGISTER (Creates a NEW Restaurant & User)
app.post('/api/auth/register', (req, res) => {
    const { username, password, role, restaurantName } = req.body;
    const safeRole = (role === 'admin' || role === 'kitchen') ? role : 'admin';
  
    // Step 1: Create the Restaurant first
    const createRestaurantQuery = 'INSERT INTO restaurants (name) VALUES (?)';
    
    // Default to 'New Kitchen' if no name provided
    db.query(createRestaurantQuery, [restaurantName || 'New Kitchen'], (err, result) => {
      if (err) {
          console.error("Restaurant Creation Error:", err);
          return res.status(500).json({ error: 'Failed to create restaurant' });
      }
  
      const newRestaurantId = result.insertId; // Get the ID (e.g., 2)
  
      // Step 2: Create the User linked to that Restaurant
      const createUserQuery = 'INSERT INTO users (username, password, role, restaurant_id) VALUES (?, ?, ?, ?)';
      
      db.query(createUserQuery, [username, password, safeRole, newRestaurantId], (err, result) => {
        if (err) {
          console.error("User Creation Error:", err);
          return res.status(400).json({ error: 'Username already exists' });
        }
        res.json({ success: true, message: 'Restaurant & User created!' });
      });
    });
  });
  
  // 2. LOGIN (Returns the Restaurant ID)
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // We fetch restaurant_id along with user info
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      if (results.length > 0) {
        const user = results[0];
        res.json({ 
          success: true, 
          user: { 
            username: user.username, 
            role: user.role, 
            restaurant_id: user.restaurant_id // ✅ Send this to frontend
          } 
        });
      } else {
        res.status(401).json({ error: 'Invalid Credentials' });
      }
    });
  });

// ==========================================
// ✅ STATUS UPDATE + PREP TIME (Updated)
// ==========================================
app.put('/api/orders/:id', async (req, res) => {
  const { status, prep_time } = req.body; 
  const id = parseInt(req.params.id);

  try {
    if (prep_time) {
        // If Chef sets time, update both status and time
        await db.query('UPDATE orders SET status = ?, prep_time = ? WHERE id = ?', [status, prep_time, id]);
    } else {
        // Normal status update
        await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    }
    
    // Notify Customer via Socket
    io.emit('order_status_updated', { id, status, prep_time });
    
    res.json({ message: 'Status updated' });
  } catch (err) { 
    console.error("Update Error:", err);
    res.status(500).json({ error: err.message }); 
  }
});

// ---- API ROUTES ----
// We keep your existing routes for Menu, Stations, Orders
app.use('/api/menu', menuRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/orders', orderRoutes);

// ---- HEALTH CHECK ----
app.get('/health', async (req, res) => {
  try {
    // Check DB connection
    await db.query('SELECT 1');
    res.json({ status: 'OK', message: 'Server & DB are healthy' });
  } catch (err) {
    res.status(500).json({ status: 'DB_ERROR', error: err.message });
  }
});

// ---- START SERVER ----
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});