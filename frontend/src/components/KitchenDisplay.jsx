import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useNavigate, Link } from 'react-router-dom'; // ✅ Import Link

const API_URL = 'https://restoscan-cloud-kitchen-load-management.onrender.com';

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [time, setTime] = useState(new Date());
  const [selectingTimeFor, setSelectingTimeFor] = useState(null);

  const socketRef = useRef(null);
  const navigate = useNavigate();

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    localStorage.removeItem('kitchenAuthToken');
    navigate('/login');
  };

  /* ================= INITIAL LOAD & SOCKETS ================= */
  useEffect(() => {
    fetchOrders();

    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    socketRef.current = io(API_URL);

    // ---- ORDER CREATED (Socket Fix) ----
    // ✅ Fix: Ensures the ticket shows FULL info instantly without refresh
    socketRef.current.on('order_created', (newOrder) => {
        console.log("New Ticket Received:", newOrder);
        setOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev;
            
            // Format the incoming socket order so the UI can read it immediately
            const formattedOrder = {
                ...newOrder,
                // Handle cases where backend sends items as a string vs object
                items: typeof newOrder.items === 'string' ? JSON.parse(newOrder.items) : newOrder.items,
                // Ensure a valid date string exists to avoid NaN:NaN error
                created_at: newOrder.created_at || new Date().toISOString(),
                status: newOrder.status || 'PENDING'
            };
            return [formattedOrder, ...prev];
        });
    });

    // ---- STATUS UPDATED ----
    socketRef.current.on('order_status_updated', ({ id, status, prep_time }) => {
      setOrders(prev => {
        if (status === 'COMPLETED') return prev.filter(o => o.id !== id);
        return prev.map(o => o.id === id ? { ...o, status, prep_time } : o);
      });
    });

    // ---- PAYMENT UPDATED ----
    socketRef.current.on('payment_updated', ({ id, payment_status }) => {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_status } : o));
    });

    // ---- SYSTEM RESET (Handled from Admin) ----
    socketRef.current.on('system_reset', () => {
      setOrders([]);
    });

    return () => {
      clearInterval(timer);
      socketRef.current?.disconnect();
    };
  }, []);

  /* ================= API CALLS ================= */
  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/orders/active`);
      setOrders(res.data);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const startCooking = async (orderId, minutes) => {
    try {
      await axios.put(`${API_URL}/api/orders/${orderId}/status`, { 
        status: 'PREPARING', 
        prep_time: minutes 
      });
      setSelectingTimeFor(null);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PREPARING', prep_time: minutes } : o));
    } catch {
      alert('Failed to start order');
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API_URL}/api/orders/${orderId}/status`, { status });
      setOrders(prev => {
        if (status === 'COMPLETED') return prev.filter(o => o.id !== orderId);
        return prev.map(o => o.id === orderId ? { ...o, status } : o);
      });
    } catch {
      alert('Update failed');
    }
  };

  /* ================= HELPERS (The Logic Fixes) ================= */

  // ✅ FIX: Prevents "NaN:NaN" by handling date parsing safely
  const getTimeElapsed = (created) => {
    if (!created) return "00:00";
    const startTime = new Date(created).getTime();
    if (isNaN(startTime)) return "00:00";

    const diff = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // ✅ FIX: Ensures items show up whether they are live (Socket) or from DB (Refresh)
  const getItems = (items) => {
    try {
      if (!items) return [];
      if (Array.isArray(items)) return items;
      if (typeof items === 'string') {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (e) {
      console.error("Item Parsing Error:", e);
      return [];
    }
  };

  const isLate = (created) => (Date.now() - new Date(created)) / 60000 > 20;

  const sortedOrders = [...orders].sort((a, b) => {
    const priority = { READY: 1, PREPARING: 2, PENDING: 3 };
    return priority[a.status] - priority[b.status];
  });

  /* ================= RENDER ================= */
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={styles.logo}>🔥</div>
          {/* ✅ Add these links here so they show up in the header */}
    <nav style={{ display: 'flex', gap: '20px', marginRight: '20px' }}>
      <Link to="/menu" style={styles.navLink}>🍔 Menu</Link>
      <Link to="/qr-codes" style={styles.navLink}>🆔 QR Factory</Link>
    </nav>
          <div>
            <h1 style={styles.title}>CHEF'S CONSOLE</h1>
            <p style={styles.subtitle}>{orders.length} TICKET{orders.length !== 1 && 'S'} QUEUED</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={styles.clockTime}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <div style={styles.grid}>
        {sortedOrders.length === 0 ? (
          <div style={styles.emptyState}><h3>All Clear</h3></div>
        ) : sortedOrders.map(order => (
          <div key={order.id} style={{ ...styles.card, borderTop: `5px solid ${getStatusColor(order.status)}` }}>
            <div style={styles.cardHeader}>
              <strong>Order #{order.id}</strong>
              <span style={{ ...styles.timerBadge, background: isLate(order.created_at) ? '#ef5350' : '#efefef', color: isLate(order.created_at) ? 'white' : 'black' }}>
                {getTimeElapsed(order.created_at)}
              </span>
            </div>

            <div style={styles.metaInfo}>
              <strong>{order.customer_name}</strong>
              <span style={{ fontSize: '0.8em', textTransform: 'uppercase', fontWeight: 'bold', color: getStatusColor(order.status) }}>
                {order.status}
              </span>
            </div>

            <div style={styles.itemsList}>
              {getItems(order.items).map((item, i) => (
                <div key={i} style={styles.itemRow}>
                  <div style={styles.qtyBox}>{item.qty || item.quantity}</div>
                  <div style={{ fontWeight: '500' }}>{item.name || item.item_name}</div>
                </div>
              ))}
            </div>

            <div style={styles.actionArea}>
              {order.status === 'PENDING' && (
                selectingTimeFor === order.id ? (
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[10, 20, 30].map(m => (
                      <button key={m} style={styles.timeBtn} onClick={() => startCooking(order.id, m)}>{m}m</button>
                    ))}
                  </div>
                ) : (
                  <button style={styles.btn} onClick={() => setSelectingTimeFor(order.id)}>START ORDER</button>
                )
              )}

              {order.status === 'PREPARING' && (
                <button style={{ ...styles.btn, background: '#42a5f5' }} onClick={() => updateStatus(order.id, 'READY')}>ORDER READY</button>
              )}

              {order.status === 'READY' && (
                <button 
                  style={{ ...styles.btn, background: order.payment_status === 'PAID' ? '#26a69a' : '#999' }} 
                  disabled={order.payment_status !== 'PAID'} 
                  onClick={() => updateStatus(order.id, 'COMPLETED')}
                >
                  {order.payment_status === 'PAID' ? 'COMPLETE' : 'AWAITING PAYMENT'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const getStatusColor = s => s === 'PENDING' ? '#ff7043' : s === 'PREPARING' ? '#42a5f5' : '#26a69a';

const styles = {

  container: { background: '#121212', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' },
  header: { background: '#1e1e1e', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' },
  logo: { fontSize: '1.8em' },
  title: { margin: 0, fontSize: '1.5em' },
  subtitle: { margin: 0, color: '#94a3b8', fontSize: '0.9em' },
  clockTime: { fontSize: '1.5em', fontWeight: 'bold' },
  navLink: {
    textDecoration: 'none',
    color: '#fff',
    fontSize: '0.9em',
    fontWeight: 'bold',
    opacity: 0.8,
    transition: '0.3s',
    cursor: 'pointer'
  },
  // For CustomerMenu (where background is light), change color to #333:
  navLinkDark: {
    textDecoration: 'none',
    color: '#333',
    fontSize: '0.9em',
    fontWeight: 'bold',
    marginRight: '15px'
  },
  grid: { padding: 30, display: 'grid', gap: 25, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' },
  card: { background: '#fff', borderRadius: 12, color: '#000', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderBottom: '1px solid #eee' },
  timerBadge: { padding: '4px 12px', borderRadius: 6, fontWeight: 'bold', fontSize: '0.9em' },
  metaInfo: { padding: '10px 20px', display: 'flex', justifyContent: 'space-between', background: '#f8f9fa' },
  itemsList: { padding: '20px', flexGrow: 1 },
  itemRow: { display: 'flex', gap: 15, marginBottom: 12, alignItems: 'center', fontSize: '1.1em' },
  qtyBox: { background: '#333', color: '#fff', padding: '2px 10px', borderRadius: 4, fontWeight: 'bold' },
  actionArea: { padding: '15px 20px', borderTop: '1px solid #eee' },
  btn: { width: '100%', padding: 14, border: 'none', color: '#fff', background: '#ff7043', cursor: 'pointer', borderRadius: 8, fontWeight: 'bold', fontSize: '1em' },
  timeBtn: { flex: 1, padding: 12, background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
  emptyState: { textAlign: 'center', marginTop: 100, width: '100%', gridColumn: '1 / -1', color: '#555' },
  logoutBtn: { background: '#e74c3c', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }
};