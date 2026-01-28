import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// ✅ Cloud Backend URL
const API_URL = 'https://restoscan-cloud-kitchen-load-management.onrender.com/api/auth/register';

export default function Signup() {
  // ✅ Added 'role' to state (Default is 'admin')
  const [formData, setFormData] = useState({ 
    username: '', 
    password: '', 
    role: 'admin' 
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Now sending username, password, AND role
      const res = await axios.post(API_URL, formData);
      if (res.data.success) {
        alert('✅ Account Created! Please login.');
        navigate('/admin-login');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{textAlign:'center', marginBottom: 20}}>
            <h1 style={{margin: 0, fontSize:'2em'}}>📝</h1>
            <h2 style={{color:'white', margin:'10px 0'}}>Create Account</h2>
            <p style={{color:'#888', fontSize:'0.9em'}}>Join the team</p>
        </div>

        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
          {/* USERNAME */}
          <input
            placeholder="Choose Username"
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            style={styles.input}
            required
          />

          {/* PASSWORD */}
          <input
            type="password"
            placeholder="Choose Password"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            style={styles.input}
            required
          />

          {/* ✅ ROLE SELECTOR (Fixes Database Error) */}
          <div style={{textAlign:'left'}}>
              <label style={{color:'#ccc', fontSize:'0.9em', marginLeft:'5px'}}>Select Role:</label>
              <select 
                value={formData.role} 
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                style={styles.select}
              >
                  <option value="admin">Manager (Admin Access)</option>
                  <option value="kitchen">Kitchen Staff (Chef View)</option>
              </select>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p style={{textAlign:'center', color:'#888', marginTop: 20, fontSize:'0.9em'}}>
          Already have an account? <Link to="/admin-login" style={{color:'#2ecc71', textDecoration:'none', fontWeight:'bold'}}>Login here</Link>
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
  select: { 
    width: '100%', 
    padding: '14px', 
    borderRadius: '8px', 
    border: '1px solid #444', 
    background: '#111', 
    color: 'white', 
    fontSize: '1em', 
    outline: 'none',
    marginTop: '5px',
    cursor: 'pointer'
  },
  button: { 
    width: '100%', 
    padding: '14px', 
    background: '#2ecc71', 
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