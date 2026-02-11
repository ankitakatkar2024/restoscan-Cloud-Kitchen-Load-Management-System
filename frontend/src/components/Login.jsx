import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// ✅ Cloud Backend URL
const API_URL = 'https://restoscan-cloud-kitchen-load-management.onrender.com/api/auth/login';

export default function Login({ onLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(API_URL, formData);
      if (res.data.success) {
        // ✅ CRITICAL UPDATE: Extract Role AND Restaurant ID
        const { role, restaurant_id } = res.data.user;

        // 1. Save Auth Token
        localStorage.setItem('adminAuth', 'true');
        
        // 2. Save User Role
        localStorage.setItem('userRole', role);

        // 3. ✅ SAVE RESTAURANT ID (This fixes the "Old Data" issue)
        // If no ID is returned, default to '1' (RestoScan HQ)
        localStorage.setItem('restaurantId', restaurant_id || '1');

        onLogin(true);

        // 4. Redirect based on Role
        if (role === 'kitchen') {
            navigate('/kitchen');
        } else {
            navigate('/admin');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{textAlign:'center', marginBottom: 20}}>
            <h1 style={{margin: 0, fontSize:'2em'}}>🔐</h1>
            <h2 style={{color:'white', margin:'10px 0'}}>Login</h2>
            <p style={{color:'#888', fontSize:'0.9em'}}>RestoScan Management</p>
        </div>

        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
          <input
            placeholder="Username"
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            style={styles.input}
            required
          />

          {error && <div style={styles.error}>{error}</div>}
          
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </form>

        <p style={{textAlign:'center', color:'#888', marginTop: 20, fontSize:'0.9em'}}>
          New Manager? <Link to="/signup" style={{color:'#e74c3c', textDecoration:'none', fontWeight:'bold'}}>Create Account</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { 
    height: '100vh', 
    background: '#111', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center',
    fontFamily: '"Segoe UI", sans-serif'
  },
  card: { 
    background: '#222', 
    padding: '40px', 
    borderRadius: '16px', 
    width: '380px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    border: '1px solid #333'
  },
  input: { 
    width: '100%', 
    padding: '14px', 
    borderRadius: '8px', 
    border: '1px solid #444', 
    background: '#111', 
    color: 'white', 
    fontSize: '1em',
    outline: 'none',
    boxSizing: 'border-box'
  },
  button: { 
    width: '100%', 
    padding: '14px', 
    background: '#e74c3c', 
    color: 'white', 
    border: 'none', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontWeight: 'bold', 
    fontSize: '1em',
    transition: '0.3s'
  },
  error: {
    background: 'rgba(231, 76, 60, 0.15)',
    color: '#e74c3c',
    padding: '10px',
    borderRadius: '6px',
    textAlign: 'center',
    fontSize: '0.9em',
    border: '1px solid #e74c3c'
  }
};