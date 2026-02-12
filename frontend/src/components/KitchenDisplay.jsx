import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

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

  /* ================= INITIAL LOAD ================= */

  useEffect(() => {
    fetchOrders();

    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    socketRef.current = io(API_URL);

    /* ---- ORDER CREATED ---- */
    socketRef.current.on('order_created', (newOrder) => {
      setOrders(prev => {
        if (prev.some(o => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });
    });

    /* ---- STATUS UPDATED ---- */
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

    /* ---- PAYMENT UPDATED ---- */
    socketRef.current.on('payment_updated', ({ id, payment_status }) => {
      setOrders(prev =>
        prev.map(o =>
          o.id === id ? { ...o, payment_status } : o
        )
      );
    });

    return () => {
      clearInterval(timer);
      socketRef.current?.disconnect();
    };
  }, []);

  /* ================= API ================= */

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
      await axios.put(
        `${API_URL}/api/orders/${orderId}/status`,
        { status: 'PREPARING', prep_time: minutes }
      );

      setSelectingTimeFor(null);

      setOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? { ...o, status: 'PREPARING', prep_time: minutes }
            : o
        )
      );
    } catch {
      alert('Failed to start order');
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await axios.put(
        `${API_URL}/api/orders/${orderId}/status`,
        { status }
      );

      setOrders(prev => {
        if (status === 'COMPLETED') {
          return prev.filter(o => o.id !== orderId);
        }

        return prev.map(o =>
          o.id === orderId ? { ...o, status } : o
        );
      });

    } catch {
      alert('Update failed');
    }
  };

  /* ================= HELPERS ================= */

  const getTimeElapsed = (created) => {
    const diff = Math.floor((Date.now() - new Date(created)) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const isLate = (created) =>
    (Date.now() - new Date(created)) / 60000 > 20;

  const getItems = (items) => {
    try {
      return Array.isArray(items)
        ? items
        : JSON.parse(items || '[]');
    } catch {
      return [];
    }
  };

  const sortedOrders = [...orders].sort((a, b) => {
    const priority = { READY: 1, PREPARING: 2, PENDING: 3 };
    return priority[a.status] - priority[b.status];
  });

  /* ================= UI ================= */

  return (
    <div style={styles.container}>

      <header style={styles.header}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={styles.logo}>🔥</div>
          <div>
            <h1 style={styles.title}>CHEF'S CONSOLE</h1>
            <p style={styles.subtitle}>
              {orders.length} TICKET{orders.length !== 1 && 'S'} QUEUED
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <div style={styles.clockTime}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>

      <div style={styles.grid}>

        {sortedOrders.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>All Clear</h3>
          </div>
        ) : sortedOrders.map(order => (

          <div
            key={order.id}
            style={{
              ...styles.card,
              borderTop: `5px solid ${getStatusColor(order.status)}`
            }}
          >

            <div style={styles.cardHeader}>
              <strong>#{order.id}</strong>

              <span style={{
                ...styles.timerBadge,
                background: isLate(order.created_at)
                  ? '#ef5350'
                  : '#efefef'
              }}>
                {getTimeElapsed(order.created_at)}
              </span>
            </div>

            <div style={styles.metaInfo}>
              <strong>{order.customer_name}</strong>
              <span>{order.status}</span>
            </div>

            <div style={styles.itemsList}>
              {getItems(order.items).map((item, i) => (
                <div key={i} style={styles.itemRow}>
                  <div style={styles.qtyBox}>
                    {item.qty || item.quantity}
                  </div>
                  {item.name}
                </div>
              ))}
            </div>

            <div style={styles.actionArea}>

              {order.status === 'PENDING' && (
                selectingTimeFor === order.id
                  ? (
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[10, 20, 30].map(m => (
                        <button
                          key={m}
                          style={styles.timeBtn}
                          onClick={() => startCooking(order.id, m)}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  )
                  : (
                    <button
                      style={styles.btn}
                      onClick={() => setSelectingTimeFor(order.id)}
                    >
                      START ORDER
                    </button>
                  )
              )}

              {order.status === 'PREPARING' && (
                <button
                  style={styles.btn}
                  onClick={() => updateStatus(order.id, 'READY')}
                >
                  ORDER READY
                </button>
              )}

              {order.status === 'READY' && (
                <button
                  style={{
                    ...styles.btn,
                    background:
                      order.payment_status === 'PAID'
                        ? '#26a69a'
                        : '#999'
                  }}
                  disabled={order.payment_status !== 'PAID'}
                  onClick={() => updateStatus(order.id, 'COMPLETED')}
                >
                  COMPLETE
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

const getStatusColor = s =>
  s === 'PENDING' ? '#ff7043'
  : s === 'PREPARING' ? '#42a5f5'
  : '#26a69a';

const styles = {
  container: { background: '#121212', minHeight: '100vh', color: '#fff' },
  header: { background: '#1e1e1e', padding: 20, display: 'flex', justifyContent: 'space-between' },
  logo: { fontSize: '1.8em' },
  title: { margin: 0 },
  subtitle: { margin: 0, color: '#94a3b8' },
  clockTime: { fontSize: '1.5em' },
  grid: { padding: 30, display: 'grid', gap: 25, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' },
  card: { background: '#fff', borderRadius: 12, color: '#000', display: 'flex', flexDirection: 'column' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', padding: 12 },
  timerBadge: { padding: '4px 10px', borderRadius: 6 },
  metaInfo: { padding: 12, display: 'flex', justifyContent: 'space-between' },
  itemsList: { padding: 12, flexGrow: 1 },
  itemRow: { display: 'flex', gap: 10, marginBottom: 8 },
  qtyBox: { background: '#333', color: '#fff', padding: '2px 8px', borderRadius: 4 },
  actionArea: { padding: 12 },
  btn: { width: '100%', padding: 12, border: 'none', color: '#fff', background: '#ff7043', cursor: 'pointer' },
  timeBtn: { flex: 1, padding: 10, background: '#2196f3', color: '#fff', border: 'none' },
  emptyState: { textAlign: 'center', marginTop: 50 },
  logoutBtn: { background: '#e74c3c', color: '#fff', border: 'none', padding: 10 }
};
