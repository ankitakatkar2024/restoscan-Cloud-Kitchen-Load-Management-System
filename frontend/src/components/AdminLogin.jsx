import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// ⚠️ YOUR NETWORK IP
const API_URL = 'https://restoscan-cloud-kitchen-load-management.onrender.com';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    axios.post(`${API_URL}/api/auth/admin-login`, { username, password })
      .then(res => {
        if (res.data.success) {
          // ✅ Save a SPECIAL token just for the kitchen
          localStorage.setItem('kitchenAuthToken', res.data.token);
          navigate('/kitchen');
        }
      })
      .catch(err => {
        setError('⛔ Invalid Credentials');
      });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{fontSize:'3em', marginBottom:'10px'}}>👨‍🍳</div>
        <h2 style={{margin:'0 0 20px 0', color:'#333'}}>Kitchen Access</h2>
        
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
          <input 
            type="text" 
            placeholder="Chef ID" 
            value={username} 
            onChange={e => setUsername(e.target.value)}
            style={styles.input}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>Unlock Kitchen</button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#2c3e50' },
  card: { background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '320px', textAlign: 'center' },
  input: { padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1em' },
  button: { padding: '12px', background: '#e67e22', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1em', fontWeight: 'bold' },
  error: { background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '5px', marginBottom: '10px', fontSize: '0.9em' }
};