import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom'; // ✅ 1. Import Navigate

// ✅ Cloud Server URL
const API_URL = 'https://restoscan-cloud-kitchen-load-management.onrender.com';

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [time, setTime] = useState(new Date());
  const [selectingTimeFor, setSelectingTimeFor] = useState(null); 
  const socketRef = useRef(null);
  
  const navigate = useNavigate(); // ✅ 2. Initialize Navigation

  // --- 🔴 LOGOUT FUNCTION ---
  const handleLogout = () => {
    // Delete the "Key" so the Guard stops letting us in
    localStorage.removeItem('kitchenAuthToken');
    // Go back to the Login Door
    navigate('/admin-login');
  };

  // ---------------- INITIAL LOAD + SOCKET ----------------
  useEffect(() => {
    fetchOrders();

    // Clock Timer
    const timer = setInterval(() => {
      setTime(new Date());
      setOrders(prev => [...prev]); // force re-render for timers
    }, 1000);

    // SOCKET INIT
    socketRef.current = io(API_URL);

    socketRef.current.on('new_order', () => {
      console.log("🔔 New Order Received!");
      fetchOrders();
    });

    socketRef.current.on('order_status_updated', ({ id, status, prep_time }) => {
      setOrders(prev => {
        if (status === 'COMPLETED') {
          return prev.filter(o => o.id !== id);
        }
        return prev.map(o =>
          o.id === id ? { ...o, status, prep_time } : o
        );
      });
    });

    // Listen for payment updates
    socketRef.current.on('payment_updated', ({ id, payment_status }) => {
        setOrders(prev => prev.map(o => 
            o.id === id ? { ...o, payment_status } : o
        ));
    });

    return () => {
      clearInterval(timer);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // ---------------- API ----------------
  const fetchOrders = () => {
    axios
      .get(`${API_URL}/api/orders/active`)
      .then(res => setOrders(res.data))
      .catch(err => console.error('Error fetching orders:', err));
  };

  const startCooking = (orderId, minutes) => {
    axios.put(`${API_URL}/api/orders/${orderId}`, { 
        status: 'PREPARING', 
        prep_time: minutes 
    })
    .then(() => {
        setSelectingTimeFor(null); // Close the time selector
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PREPARING', prep_time: minutes } : o));
    })
    .catch(() => alert("Failed to start order"));
  };

  const updateStatus = (orderId, newStatus) => {
    axios
      .put(`${API_URL}/api/orders/${orderId}`, {
        status: newStatus
      })
      .then(() => {
        if (newStatus === 'COMPLETED') {
          setOrders(prev => prev.filter(o => o.id !== orderId));
        } else {
          setOrders(prev =>
            prev.map(o =>
              o.id === orderId ? { ...o, status: newStatus } : o
            )
          );
        }
      })
      .catch(err => {
        console.error(err);
        alert('Failed to update order');
      });
  };

  // ---------------- HELPERS ----------------
  const getTimeElapsed = (createdStr) => {
    const created = new Date(createdStr);
    const diff = Math.floor((new Date() - created) / 1000);
    const mm = Math.floor(diff / 60).toString().padStart(2, '0');
    const ss = (diff % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const isLate = (createdStr) => {
    const diff = (new Date() - new Date(createdStr)) / 1000 / 60;
    return diff > 20;
  };

  const getItems = (items) => {
    try {
      if (Array.isArray(items)) return items;
      return typeof items === 'string' ? JSON.parse(items) : [];
    } catch { return []; }
  };

  const sortedOrders = [...orders].sort((a, b) => {
    const priority = { READY: 1, PREPARING: 2, PENDING: 3 };
    return priority[a.status] - priority[b.status];
  });

  // ---------------- UI ----------------
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={styles.logo}>🔥</div>
          <div>
            <h1 style={styles.title}>
              CHEF'S <span style={{ color: '#4fc3f7', fontWeight: '300' }}>CONSOLE</span>
            </h1>
            <p style={styles.subtitle}>
              {orders.length} TICKET{orders.length !== 1 ? 'S' : ''} QUEUED
            </p>
          </div>
        </div>
        
        <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
            <div style={styles.clockTime}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {/* ✅ 3. LOGOUT BUTTON */}
            <button onClick={handleLogout} style={styles.logoutBtn}>
                Logout 🔒
            </button>
        </div>
      </header>

      <div style={styles.grid}>
        {sortedOrders.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '5em', opacity: 0.6 }}>👨‍🍳</div>
            <h3>All Clear, Chef!</h3>
          </div>
        ) : (
          sortedOrders.map(order => (
            <div
              key={order.id}
              style={{ ...styles.card, borderTop: `5px solid ${getStatusColor(order.status)}` }}
            >
              <div style={styles.cardHeader}>
                <span style={styles.orderId}>#{order.id}</span>
                <span style={{
                  ...styles.timerBadge,
                  background: isLate(order.created_at) ? '#ef5350' : '#efefef',
                  color: isLate(order.created_at) ? '#fff' : '#455a64'
                }}>
                  ⏱ {getTimeElapsed(order.created_at)}
                </span>
              </div>

              <div style={styles.metaInfo}>
                <strong>{order.customer_name}</strong>
                <span
                  style={{
                    color: getStatusColor(order.status),
                    background: getStatusBg(order.status),
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {order.status}
                </span>
              </div>

              <div style={styles.itemsList}>
                {getItems(order.items).map((item, idx) => (
                  <div key={idx} style={styles.itemRow}>
                    <div style={styles.qtyBox}>{item.qty || item.quantity}</div>
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>

              <div style={styles.actionArea}>
                
                {/* 1. PENDING STATE -> SHOW TIME SELECTOR */}
                {order.status === 'PENDING' && (
                  <>
                    {selectingTimeFor === order.id ? (
                        <div style={{display:'flex', gap:'5px'}}>
                            <button onClick={() => startCooking(order.id, 10)} style={styles.timeBtn}>10m</button>
                            <button onClick={() => startCooking(order.id, 20)} style={styles.timeBtn}>20m</button>
                            <button onClick={() => startCooking(order.id, 30)} style={styles.timeBtn}>30m</button>
                            <button onClick={() => setSelectingTimeFor(null)} style={{...styles.timeBtn, background:'#666'}}>X</button>
                        </div>
                    ) : (
                        <button
                            style={{ ...styles.btn, background: '#ff7043' }}
                            onClick={() => setSelectingTimeFor(order.id)}
                        >
                            START ORDER
                        </button>
                    )}
                  </>
                )}

                {/* 2. PREPARING STATE */}
                {order.status === 'PREPARING' && (
                  <div>
                      {order.prep_time && (
                          <div style={{textAlign:'center', marginBottom:'8px', color:'#1976d2', fontWeight:'bold', fontSize:'0.9em'}}>
                              Target: {order.prep_time} mins
                          </div>
                      )}
                      <button
                        style={{ ...styles.btn, background: '#42a5f5' }}
                        onClick={() => updateStatus(order.id, 'READY')}
                      >
                        ORDER READY
                      </button>
                  </div>
                )}

                {/* 3. READY STATE -> CHECK PAYMENT */}
                {order.status === 'READY' && (
                  <button
                    style={{
                      ...styles.btn,
                      background:
                        order.payment_status === 'PAID' ? '#26a69a' : '#bdbdbd',
                      cursor:
                        order.payment_status === 'PAID'
                          ? 'pointer'
                          : 'not-allowed'
                    }}
                    disabled={order.payment_status !== 'PAID'}
                    onClick={() => {
                      if (order.payment_status === 'PAID') {
                        updateStatus(order.id, 'COMPLETED');
                      }
                    }}
                  >
                    {order.payment_status === 'PAID'
                      ? 'COMPLETE & CLOSE'
                      : 'WAITING PAYMENT'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------- STYLES & COLORS ----------------
const getStatusColor = (s) =>
  s === 'PENDING' ? '#ff7043' : s === 'PREPARING' ? '#42a5f5' : s === 'READY' ? '#26a69a' : '#ccc';

const getStatusBg = (s) =>
  s === 'PENDING' ? '#fbe9e7' : s === 'PREPARING' ? '#e3f2fd' : '#e0f2f1';

const styles = {
  container: { background: '#121212', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' },
  header: { background: '#1e1e1e', padding: '15px 30px', display: 'flex', justifyContent: 'space-between' },
  logo: { fontSize: '1.8em' },
  title: { margin: 0 },
  subtitle: { margin: 0, color: '#94a3b8' },
  clockTime: { fontSize: '1.5em' },
  grid: { padding: '30px', display: 'grid', gap: '25px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' },
  card: { background: '#fff', borderRadius: '12px', color: '#000', display: 'flex', flexDirection: 'column' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom:'1px solid #eee' },
  orderId: { fontWeight: '800' },
  timerBadge: { padding: '4px 10px', borderRadius: '6px' },
  metaInfo: { padding: '12px', display: 'flex', justifyContent: 'space-between', borderBottom:'1px solid #eee' },
  itemsList: { padding: '12px', flexGrow: 1 },
  itemRow: { display: 'flex', gap: '10px', marginBottom: '10px', fontSize:'1.1em' },
  qtyBox: { background: '#333', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight:'bold' },
  actionArea: { padding: '12px', borderTop:'1px solid #eee' },
  btn: { width: '100%', padding: '12px', border: 'none', color: '#fff', cursor: 'pointer', fontWeight:'bold', borderRadius:'4px' },
  timeBtn: { flex:1, padding:'10px', background:'#2196f3', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'0.9em' },
  emptyState: { gridColumn: '1 / -1', textAlign: 'center', marginTop:'50px' },
  // ✅ 4. STYLE FOR LOGOUT BUTTON
  logoutBtn: { background: '#e74c3c', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }
};