import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import io from 'socket.io-client';

// ✅ CONFIGURATION
const API_URL = 'https://restoscan-cloud-kitchen-load-management.onrender.com';

export default function QRCodeGenerator() {
  const socketRef = useRef(null);
  // ✅ NEW: Points to your live Render link for all phones
  const baseUrl = "https://restoscan-cloud-kitchen-load-management.onrender.com";
  const [tableNum, setTableNum] = useState(1);
  
  // ✅ Initialize Socket Connection
  useEffect(() => {
    socketRef.current = io(API_URL);
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // ✅ DYNAMIC TABLE CHANGE LOGIC: Updates the factory and broadcasts to Menu/Kitchen
  const handleTableChange = (e) => {
    const newNum = e.target.value;
    setTableNum(newNum);
    
    // ✅ This sends a signal to all other screens to update to this table instantly
    if (socketRef.current) {
        socketRef.current.emit('force_table_change', { table: newNum });
    }
  };

  const menuLink = `${baseUrl}/menu?table=${tableNum}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={styles.container}>
      <header style={styles.navBar}>
        <div style={styles.navLinks}>
             <span>👨‍🍳 Kitchen</span>
             <span>🍔 Menu</span>
             <span>🆔 QR Codes</span>
             <span>🛠️ Admin</span>
             <button style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <div style={styles.card}>
        <h1 style={{ color: '#fff', margin: '0', fontSize: '1.8em' }}>📱 QR Code Factory</h1>
        <p style={{ color: '#aaa', marginBottom: '20px' }}>Generate codes for your tables.</p>

        {/* CONTROLS */}
        <div className="no-print" style={styles.controlBox}>
          <label style={styles.label}>Select Table Number:</label>
          <input
            type="number"
            value={tableNum}
            onChange={handleTableChange}
            style={styles.input}
            min="1"
          />
        </div>

        {/* THE ORANGE THEME TICKET */}
        <div style={styles.ticket} className="printable-ticket">
          <div style={styles.brandHeader}>
             <h2 style={{ margin: 0, fontSize: '1.2em', letterSpacing: '1px' }}>RESTOSCAN MENU</h2>
             <h1 style={{ margin: '10px 0', color: '#FF4500', fontSize: '2em' }}>TABLE {tableNum}</h1>
          </div>
          
          <div style={styles.qrWrapper}>
            <QRCodeCanvas value={menuLink} size={180} level="H" />
          </div>

          <p style={styles.scanText}>Scan to order food instantly.</p>
          <div style={{marginTop: '5px'}}>
             <small style={{ color: '#777', fontSize: '0.65em' }}>{menuLink}</small>
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
            border: 2px dashed #FF4500 !important; 
            box-shadow: none !important;
            margin: 20px auto !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0a0a0a', paddingBottom: '40px', fontFamily: 'sans-serif' },
  navBar: { background: '#1a1a1a', padding: '15px 40px', display: 'flex', justifyContent: 'center', marginBottom: '40px' },
  navLinks: { display: 'flex', gap: '25px', color: '#fff', alignItems: 'center', fontSize: '0.9em', fontWeight: 'bold' },
  logoutBtn: { background: '#FF4500', color: '#fff', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer' },
  card: { background: '#121212', maxWidth: '480px', margin: '0 auto', padding: '40px', borderRadius: '15px', textAlign: 'center', border: '1px solid #333' },
  controlBox: { marginBottom: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  label: { color: '#fff', fontSize: '1em' },
  input: { padding: '8px', width: '60px', background: '#1a1a1a', color: '#fff', border: '1px solid #444', textAlign: 'center', borderRadius: '5px' },
  ticket: { background: '#fff', color: '#000', padding: '30px', borderRadius: '10px', border: '2px dashed #FF4500', margin: '0 auto' },
  brandHeader: { marginBottom: '20px' },
  qrWrapper: { padding: '10px', background: '#fff', display: 'inline-block' },
  scanText: { marginTop: '15px', fontSize: '0.9em', color: '#444', fontWeight: '500' },
  printButton: { background: '#FF4500', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '30px', width: '80%' }
};