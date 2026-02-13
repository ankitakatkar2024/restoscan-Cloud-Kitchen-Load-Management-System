import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import io from 'socket.io-client';
import { Link, useNavigate } from 'react-router-dom'; // ✅ Added Link & useNavigate

// ✅ CONFIGURATION
const API_URL = 'https://restoscan-cloud-kitchen-load-management.onrender.com';

export default function QRCodeGenerator() {
  const socketRef = useRef(null);
  const navigate = useNavigate();
  
  // Base URL for the menu links
  const baseUrl = "https://restoscan-cloud-kitchen-load-management.onrender.com";
  const [tableNum, setTableNum] = useState(1);
  
  // ✅ Initialize Socket Connection
  useEffect(() => {
    socketRef.current = io(API_URL);
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // ✅ Broadcaster: Updates other screens instantly
  const handleTableChange = (e) => {
    const newNum = e.target.value;
    setTableNum(newNum);
    
    if (socketRef.current) {
        socketRef.current.emit('force_table_change', { table: newNum });
    }
  };

  const menuLink = `${baseUrl}/menu?table=${tableNum}`;

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('kitchenAuthToken');
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      {/* ✅ UPDATED NAVIGATION (Using Link component) */}
      <header style={styles.navBar} className="no-print">
        <div style={styles.navLinks}>
             <Link to="/kitchen" style={styles.navItem}>👨‍🍳 Kitchen</Link>
             <Link to="/menu" style={styles.navItem}>🍔 Menu</Link>
             <Link to="/qr-codes" style={{...styles.navItem, color: '#FF4500'}}>🆔 QR Codes</Link>
             <Link to="/admin" style={styles.navItem}>🛠️ Admin</Link>
             <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <div style={styles.card}>
        <div className="no-print">
            <h1 style={{ color: '#fff', margin: '0', fontSize: '1.8em' }}>📊 QR Code Factory</h1>
            <p style={{ color: '#aaa', marginBottom: '25px', fontSize: '0.9em' }}>Generate and print codes for your tables.</p>

            {/* CONTROLS */}
            <div style={styles.controlBox}>
              <label style={styles.label}>Select Table Number:</label>
              <input
                type="number"
                value={tableNum}
                onChange={handleTableChange}
                style={styles.input}
                min="1"
              />
            </div>
        </div>

        {/* THE PRINTABLE TICKET */}
        <div style={styles.ticket} className="printable-ticket">
          <div style={styles.brandHeader}>
             <h2 style={{ margin: 0, fontSize: '1.2em', letterSpacing: '2px', color: '#555' }}>RESTOSCAN MENU</h2>
             <h1 style={{ margin: '10px 0', color: '#FF4500', fontSize: '2.4em', fontWeight: '800' }}>TABLE {tableNum}</h1>
          </div>
          
          <div style={styles.qrWrapper}>
            {/* ✅ Correct library usage */}
            <QRCodeCanvas value={menuLink} size={200} level="H" includeMargin={true} />
          </div>

          <p style={styles.scanText}>Scan to order food instantly</p>
          <div style={{marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px'}}>
             <code style={{ color: '#999', fontSize: '0.7em', wordBreak: 'break-all' }}>{menuLink}</code>
          </div>
        </div>

        <button onClick={handlePrint} className="no-print" style={styles.printButton}>
          🖨️ Print This QR Code
        </button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .printable-ticket { 
            border: 3px dashed #FF4500 !important; 
            box-shadow: none !important;
            margin: 0 auto !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0a0a0a', paddingBottom: '60px', fontFamily: 'sans-serif' },
  navBar: { background: '#1a1a1a', padding: '15px 20px', display: 'flex', justifyContent: 'center', borderBottom: '1px solid #333' },
  navLinks: { display: 'flex', gap: '30px', alignItems: 'center' },
  navItem: { color: '#fff', textDecoration: 'none', fontSize: '0.85em', fontWeight: '600', opacity: 0.8 },
  logoutBtn: { background: '#FF4500', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  card: { background: '#121212', maxWidth: '500px', margin: '40px auto', padding: '30px', borderRadius: '20px', textAlign: 'center', border: '1px solid #222' },
  controlBox: { marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', background: '#1a1a1a', padding: '15px', borderRadius: '12px' },
  label: { color: '#eee', fontSize: '0.95em' },
  input: { padding: '10px', width: '70px', background: '#0a0a0a', color: '#fff', border: '1px solid #FF4500', textAlign: 'center', borderRadius: '8px', fontSize: '1.1em', fontWeight: 'bold' },
  ticket: { background: '#fff', color: '#000', padding: '40px 20px', borderRadius: '15px', border: '2px dashed #FF4500', margin: '0 auto' },
  brandHeader: { marginBottom: '25px' },
  qrWrapper: { padding: '15px', background: '#fff', display: 'inline-block', borderRadius: '10px', border: '1px solid #f0f0f0' },
  scanText: { marginTop: '20px', fontSize: '1em', color: '#333', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' },
  printButton: { background: '#FF4500', color: 'white', padding: '15px 25px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '30px', width: '100%' }
};