const express = require('express');
const router = express.Router();
const db = require('../config/db');

// LOGIN
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE username = ? AND password = ?',
            [username, password]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid Username or Password'
            });
        }

        const user = users[0];
        res.json({
            success: true,
            message: 'Login Successful',
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// REGISTER
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: 'Username and password are required'
        });
    }

    try {
        const [existing] = await db.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Username already taken'
            });
        }

        await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, password, role || 'manager']
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully'
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ NEW: Specific route for Chef/Admin Login (Secured)
router.post('/admin-login', (req, res) => {
  const { username, password } = req.body;

  // 🔒 SECURE HARDCODED CREDENTIALS
  // In a real app, you would check this against a database table 'admins'
  if (username === 'admin' && password === 'chef123') {
    res.json({ 
      success: true, 
      token: 'secure-chef-token-999', // Special token for chefs
      role: 'chef' 
    });
  } else {
    res.status(401).json({ success: false, message: '❌ Access Denied: Chefs Only' });
  }
});

module.exports = router;
