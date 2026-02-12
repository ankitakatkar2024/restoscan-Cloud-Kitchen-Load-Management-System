const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. LOGIN (General)
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
                error: 'Invalid Credentials'
            });
        }

        const user = users[0];
        
        // Prevent Kitchen Staff from accessing Admin Dashboard
        if (user.role === 'kitchen') {
             return res.status(403).json({
                success: false,
                error: 'Kitchen staff cannot access Manager Dashboard'
            });
        }

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

// 2. REGISTER (Create New Users)
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

        // Default to 'admin' if not specified
        await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, password, role || 'admin']
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully'
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. KITCHEN LOGIN (For Chefs) - ✅ FIXED
router.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;

  try {
      // 1. Check Hardcoded Backdoor (Optional, keeps your old logic working)
      if (username === 'admin' && password === 'chef123') {
           return res.json({ success: true, token: 'secure-chef-hardcoded', role: 'kitchen' });
      }

      // 2. Check Database (Connects to Signup Page)
      const [users] = await db.query(
          'SELECT * FROM users WHERE username = ? AND password = ?',
          [username, password]
      );

      if (users.length === 0) {
          return res.status(401).json({ success: false, message: 'Invalid Credentials' });
      }

      const user = users[0];

      // 3. Verify Role
      if (user.role !== 'kitchen') {
          return res.status(403).json({ success: false, message: 'Only Kitchen Staff can access this panel' });
      }

      res.json({ 
        success: true, 
        token: `secure-chef-token-${user.id}`, 
        role: 'kitchen' 
      });

  } catch (err) {
      res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;