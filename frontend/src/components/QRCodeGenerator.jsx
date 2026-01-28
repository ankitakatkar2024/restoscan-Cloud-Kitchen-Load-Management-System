import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function QRCodeGenerator() {
  // ✅ SMART URL: Automatically detects if you are on Localhost or Cloud
  const baseUrl = window.location.origin;
  const [tableNum, setTableNum] = useState(1);
  
  const menuLink = `${baseUrl}/menu?table=${tableNum}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={{ color: '#fff' }}>🖨️ QR Code Factory</h1>
        <p style={{ color: '#bbb' }}>Generate codes for your tables.</p>

        {/* CONTROLS */}
        <div className="no-print" style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '1.2em', marginRight: '10px', color: '#ddd' }}>
            Select Table Number:
          </label>
          <input
            type="number"
            value={tableNum}
            onChange={(e) => setTableNum(e.target.value)}
            style={styles.input}
            min="1"
          />
        </div>

        {/* THE TICKET */}
        {/* ✅ Added 'printable-ticket' class for the print logic below */}
        <div style={styles.ticket} className="printable-ticket">
          <h2 style={{ margin: '0 0 10px 0', color: 'inherit' }}>RESTOSCAN MENU</h2>
          <h3 style={{ color: '#ff5722', fontSize: '2em', margin: '0' }}>
            TABLE {tableNum}
          </h3>

          <div style={{ background: 'white', padding: '15px', display: 'inline-block', margin: '15px 0', border: '1px solid #ccc' }}>
            <QRCodeCanvas value={menuLink} size={180} />
          </div>

          <p style={{ fontSize: '0.9em', color: 'inherit' }}>
            Scan to order food instantly.<br />
            <small style={{ wordBreak: 'break-all' }}>{menuLink}</small>
          </p>
        </div>

        <button onClick={handlePrint} className="no-print" style={styles.printButton}>
          🖨️ Print This QR Code
        </button>
      </div>

      {/* ✅ PRINT CSS: Forces White Paper / Black Text when printing */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .card { box-shadow: none; border: none; padding: 0; margin: 0; width: 100%; max-width: none; }
          
          /* Force Ticket to look like a clean paper receipt */
          .printable-ticket { 
            border: 2px solid black !important; 
            background: white !important; 
            color: black !important;
            box-shadow: none !important;
            width: 300px; 
            margin: 20px auto;
          }
          
          /* Ensure text is black */
          h1, h2, p { color: black !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0f0f0f',
    padding: '40px',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif'
  },
  card: {
    background: '#1c1c1c',
    maxWidth: '500px',
    margin: '0 auto',
    padding: '30px',
    borderRadius: '16px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
  },
  input: {
    padding: '10px',
    fontSize: '1.2em',
    width: '60px',
    textAlign: 'center',
    borderRadius: '6px',
    border: '1px solid #444',
    background: '#111',
    color: '#fff'
  },
  ticket: {
    border: '2px dashed #555',
    padding: '30px',
    background: '#121212',
    color: '#fff', // White text on Dark Screen
    borderRadius: '12px',
    margin: '20px auto',
    maxWidth: '350px'
  },
  printButton: {
    background: '#ff5722',
    color: 'white',
    padding: '15px 30px',
    fontSize: '1.1em',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '10px'
  }
};