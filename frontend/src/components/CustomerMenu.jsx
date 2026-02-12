import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import QRCode from "react-qr-code";

// ✅ CONFIGURATION
const API_URL = 'https://restoscan-cloud-kitchen-load-management.onrender.com';
const MY_UPI_ID = "ankitakatkar2004@oksbi"; 
const notifySound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // You can replace this with any URL
const MY_NAME = "RestoScan Kitchen";
const PLACEHOLDER_IMG = 'https://placehold.co/150';

export default function CustomerMenu() {
  const socketRef = useRef(null);
  const [searchParams] = useSearchParams();
  
  // ✅ CRITICAL FIX: "Sticky" Table Number Logic
  // 1. Checks URL directly first (most reliable source).
  // 2. If URL has ?table=5, it SAVES it to storage and uses it.
  // 3. If URL has no table, it loads the last saved table from storage.
  // 4. Defaults to '1' only if nothing else exists.
// ✅ Replace your tableNumber state with this exact logic
// ✅ DYNAMIC TABLE SWITCHING LOGIC
const [tableNumber, setTableNumber] = useState(() => {
    // Check URL first - this is the "Source of Truth" for a new scan
    const params = new URLSearchParams(window.location.search);
    const urlTable = params.get('table');
    
    if (urlTable) {
        // If a new number is in the URL, overwrite the old memory immediately
        localStorage.setItem('myTableNum', urlTable);
        return urlTable;
    }
    
    // If no URL param, use the last scanned table from memory
    const savedTable = localStorage.getItem('myTableNum');
    return savedTable || '1'; // Default to 1 if it's a direct link visit
});

// ✅ WATCH FOR URL CHANGES
useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTable = params.get('table');
    if (urlTable && urlTable !== tableNumber) {
        setTableNumber(urlTable);
        localStorage.setItem('myTableNum', urlTable);
    }
}, [searchParams, tableNumber]);

  // --- STATE MANAGEMENT ---
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [activeOrder, setActiveOrder] = useState(null);
  const [showBill, setShowBill] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null); 
  const [stationLoad, setStationLoad] = useState({});
  const [addedItem, setAddedItem] = useState(null);
  
  // UX States
  const [isOrdering, setIsOrdering] = useState(false); 
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [onlyVeg, setOnlyVeg] = useState(false);

  // Dining Journey Sorting
  const diningOrder = [
    'Breakfast', 'Starters', 'Soups', 'Salads', 'Platters', 'Local Specials',
    'Mains', 'Pizza', 'Kids', 'Vegan & Healthy', 'Staples', 'Breads', 'Rice',
    'Pasta', 'Sides', 'Desserts', 'Bakery', 'Beverages', 'Tea', 'Water',
    'Alcohol', 'Sauces', 'Add-Ons'
  ];

  // --- 1. INITIAL LOAD & RESTORE SESSION ---
  useEffect(() => {
    // Force update table number if URL changes (e.g. scanning a new code while app is open)
    const urlTable = searchParams.get('table');
    if (urlTable) {
        setTableNumber(urlTable);
        localStorage.setItem('myTableNum', urlTable);
    }

    // 1. Fetch Menu
    axios.get(`${API_URL}/api/menu`)
      .then(res => {
        const availableItems = res.data.filter(item => item.is_available !== 0);
        setMenu(availableItems);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error loading menu:", err);
        setIsLoading(false);
      });

    // 2. Restore Order from LocalStorage
    const savedOrderId = localStorage.getItem('activeOrderId');
    if (savedOrderId) {
      axios.get(`${API_URL}/api/orders/${savedOrderId}`)
        .then(res => {
          const o = res.data;
          // If order is completed or invalid, clear local storage
          if (!o || o.status === 'COMPLETED') {
            localStorage.removeItem('activeOrderId');
            return;
          }

          let parsedItems = [];
          try {
             parsedItems = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
          } catch(e) {
             console.error("Failed to parse items", e);
             parsedItems = [];
          }

          setActiveOrder({
            id: o.id,
            status: o.status,
            payment_status: o.payment_status || 'PENDING',
            items: parsedItems.map(i => ({
              name: i.name || i.item_name,
              qty: i.quantity || i.qty,
              price: i.price
            })),
            total_price: o.total_price,
            prep_time: o.prep_time
          });
        })
        .catch(() => localStorage.removeItem('activeOrderId'));
    }

    // 3. Set Global Styles Safely
    document.body.style.backgroundColor = '#fdfbf7';
    return () => {
        document.body.style.backgroundColor = ''; 
    };
  }, [searchParams]);

  // --- 2. SOCKET CONNECTION ---
// --- 2. SOCKET CONNECTION ---

useEffect(() => {
  socketRef.current = io(API_URL);

  // Keep your force_table_change listener
  socketRef.current.on('force_table_change', ({ table }) => {
      console.log("Remote Update Received: Switching to Table", table);
      setTableNumber(table);
      localStorage.setItem('myTableNum', table);
  });

  // ✅ UPDATED LISTENER WITH SOUND AND VIBRATION
  socketRef.current.on('order_status_updated', ({ id, status, prep_time }) => {
    setActiveOrder(prev => {
      if (!prev || prev.id !== id) return prev;

      // ✅ Play sound when status changes (e.g., PENDING -> PREPARING or PREPARING -> READY)
      if (status !== prev.status) {
          notifySound.play().catch(e => console.log("Audio play failed:", e));
          
          // Optional: Add vibration for mobile devices
          if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
          }
      }

      if (status === 'COMPLETED') {
           localStorage.removeItem('activeOrderId');
           setShowBill(false);
           return null;
      }
      
      return { ...prev, status, prep_time };
    });
  });

  // Keep your other listeners
  socketRef.current.on('payment_updated', ({ id, payment_status }) => {
    setActiveOrder(prev => {
      if (prev && prev.id === id && payment_status === 'PAID') {
          return { ...prev, payment_status };
      }
      return prev;
    });
  });

  socketRef.current.on('station_load_update', ({ stationId, currentLoad, maxLoad }) => {
    setStationLoad(prev => ({
      ...prev,
      [stationId]: { currentLoad, maxLoad }
    }));
  });

  return () => {
    if (socketRef.current) socketRef.current.disconnect();
  };
}, [tableNumber]); // Added tableNumber to dependency to ensure socket has context if needed

  // --- HELPERS ---
  const isKitchenBusy = () => {
    // Simple check: if any station is overloaded, warn the user
    // Note: Backend now has a 1000 limit, so this is mostly for UI feedback
    if (Object.keys(stationLoad).length === 0) return false;
    return Object.values(stationLoad).some(s => s.currentLoad >= s.maxLoad);
  };

  const getPrice = (price) => Number(price).toFixed(0);
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  
  const totalPrice = Object.keys(cart).reduce((sum, id) => {
    const item = menu.find(i => i.id === parseInt(id));
    if (!item) return sum;
    return sum + (item.price * cart[id]);
  }, 0);

  const uniqueCats = [...new Set(menu.map(item => item.category))];
  const sortedTabs = [
    'All',
    ...diningOrder.filter(c => uniqueCats.includes(c)),
    ...uniqueCats.filter(c => !diningOrder.includes(c))
  ];

  // --- ACTIONS ---
  const addToCart = (item) => {
    setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
    setAddedItem(item.id);
    setTimeout(() => setAddedItem(null), 1000);
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[id] > 1) newCart[id]--;
      else delete newCart[id];
      return newCart;
    });
  };

  const placeOrder = () => {
    // 1. Validation Checks
    if (isOrdering) return;
    
    // Check if cart is empty
    const orderItems = Object.keys(cart).map(id => {
      const item = menu.find(i => i.id === parseInt(id));
      if (!item) return null;
      return {
        id: item.id,
        name: item.name,
        quantity: cart[id],
        station_id: item.station_id || 1, // Default to 1 if missing
        price: item.price
      };
    }).filter(Boolean);

    if (orderItems.length === 0) return alert("Your cart is empty!");

    // 2. Lock UI
    setIsOrdering(true);
    const totalOrderPrice = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 3. API Call
    axios.post(`${API_URL}/api/orders`, {
      customer_name: `Table ${tableNumber}`, // ✅ USES THE STICKY TABLE NUMBER
      items: orderItems,
      total_price: totalOrderPrice
    })
    .then(res => {
      const order = res.data.order || res.data; 
      
      setActiveOrder({
        id: order.id || res.data.orderId,
        status: order.status || 'PENDING',
        payment_status: 'PENDING',
        items: orderItems.map(i => ({
          name: i.name,
          qty: i.quantity,
          price: i.price
        })),
        total_price: totalOrderPrice
      });

      localStorage.setItem('activeOrderId', order.id || res.data.orderId);
      setCart({});
    })
    .catch(err => {
      console.error("Order Place Error:", err);
      // Detailed error for debugging, or simple message for user
      const msg = err.response?.data?.error || "Failed to place order. Check connection.";
      alert(`❌ ${msg}`);
    })
    .finally(() => {
      setIsOrdering(false); // Unlock UI
    });
  };

  // --- PAYMENT LOGIC ---
  const openBill = () => {
      setPaymentMethod(null); 
      setShowBill(true);
  };

  const handlePaymentSelection = (method) => {
    setPaymentMethod(method);
    // Tell backend user is attempting to pay
    if(activeOrder?.id) {
        axios.put(`${API_URL}/api/orders/${activeOrder.id}/request-payment`, { method })
            .catch(() => {}); 
    }
  };

  const confirmPayment = async () => {
    if(!activeOrder?.id) return;

    try {
        // ✅ Notify Manager Dashboard
        await axios.put(`${API_URL}/api/orders/${activeOrder.id}/request-payment`, { 
            method: paymentMethod || 'UPI',
            status: 'VERIFICATION_REQUESTED'
        });
        alert("✅ Manager Notified! Please stay on this screen while we verify.");
    } catch (error) {
        console.error("Payment notification failed", error);
        alert("⚠️ Network Error: Please wave to the manager to confirm payment.");
    }
  };

  const closeSession = async () => {
    if (activeOrder) {
      try {
        await axios.put(`${API_URL}/api/orders/${activeOrder.id}/status`, { 
            status: 'COMPLETED' 
        });
      } catch (err) {
        console.error("Failed to close order on server", err);
      }
    }
    localStorage.removeItem('activeOrderId');
    setShowBill(false);
    setActiveOrder(null);
  };

  // Filter Menu Logic
  const filteredMenu = menu
    .filter(item => {
      const categoryMatch = selectedCategory === 'All' || item.category === selectedCategory;
      const vegMatch = onlyVeg ? item.is_veg : true;
      return categoryMatch && vegMatch;
    })
    .sort((a, b) => diningOrder.indexOf(a.category) - diningOrder.indexOf(b.category));


  // ==================== RENDER: LOADING ====================
  if (isLoading) {
      return <div style={{...styles.container, display:'flex', justifyContent:'center', alignItems:'center'}}>
          <h3>Loading Menu...</h3>
      </div>;
  }

  // ==================== RENDER: BILL POPUP ====================
  if (showBill && activeOrder && activeOrder.status === 'READY') {
    const total = activeOrder.total_price;
    const upiLink = `upi://pay?pa=${MY_UPI_ID}&pn=${MY_NAME}&am=${total}&cu=INR`;

    return (
      <div style={styles.billOverlay}>
        <div style={styles.billCard}>
          <h3 style={{ textAlign: 'center', margin: '0 0 15px 0' }}>🧾 Final Bill: ₹{total}</h3>
          <hr style={{ borderColor: '#eee', marginBottom: '20px' }} />
          
          {activeOrder.payment_status === 'PAID' ? (
             <div style={{textAlign:'center', color:'#2ecc71'}}>
                <div style={{fontSize:'4em'}}>✅</div>
                <h1>PAID</h1>
                <p>Thank you for dining with us!</p>
                <button style={styles.closeBillBtn} onClick={closeSession}>
                   Close Session & Leave
                </button>
             </div>
          ) : (
             <>
                {!paymentMethod ? (
                    // SCREEN 1: Select Method
                    <div style={{display:'flex', gap:15, flexDirection:'column'}}>
                        <p style={{textAlign:'center', color:'#666'}}>How would you like to pay?</p>
                        <button style={styles.upiBtn} onClick={() => handlePaymentSelection('UPI')}>
                            📱 UPI / QR Code
                        </button>
                        <button style={styles.cashBtn} onClick={() => handlePaymentSelection('CASH')}>
                            💵 Cash at Counter
                        </button>
                        <button style={styles.backBtn} onClick={() => setShowBill(false)}>Back to Menu</button>
                    </div>
                ) : paymentMethod === 'UPI' ? (
                    // SCREEN 2A: UPI QR
                    <div style={{textAlign:'center'}}>
                        <p style={{marginBottom:'10px', fontWeight:'bold'}}>Scan to Pay ₹{total}</p>
                        <div style={{background:'white', padding:10, border:'1px solid #eee', display:'inline-block', borderRadius:'8px'}}>
                            <QRCode value={upiLink} size={180} />
                        </div>
                        <p style={{fontSize:'0.8em', color:'#888', marginTop:'10px'}}>Manager will confirm payment automatically.</p>
                        
                        <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                            <button style={{...styles.verifyBtn, flex:1}} onClick={confirmPayment}>
                                I Have Paid
                            </button>
                            <button style={{...styles.backBtn, flex:1, marginTop:0, background:'#eee'}} onClick={() => setPaymentMethod(null)}>
                                Change Method
                            </button>
                        </div>
                    </div>
                ) : (
                    // SCREEN 2B: CASH
                    <div style={{textAlign:'center'}}>
                        <div style={{fontSize:'4em', margin:'10px 0'}}>💵</div>
                        <h3>Please pay at the counter.</h3>
                        <p style={{color:'#666'}}>Show this screen to the manager.</p>
                        <div style={{background:'#f9f9f9', padding:'10px', borderRadius:'8px', margin:'15px 0'}}>
                            <strong>Order #{activeOrder.id}</strong><br/>
                            Table {tableNumber}
                        </div>
                        <button style={styles.backBtn} onClick={() => setPaymentMethod(null)}>Change Method</button>
                    </div>
                )}
             </>
          )}
        </div>
      </div>
    );
  }

  // ==================== RENDER: STATUS SCREEN ====================
  if (activeOrder) {
    return (
      <div style={styles.statusContainer}>
        <div style={styles.statusCard}>
          <h1 style={{ fontSize: '1.2em', color: '#888', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Order #{activeOrder.id}
          </h1>

          <h2 style={{ fontSize: '2.5em', color: getStatusColor(activeOrder.status), margin: '15px 0' }}>
            {getStatusText(activeOrder.status)}
          </h2>

          <div style={{ height: '6px', width: '100%', background: '#eee', borderRadius: '3px', overflow: 'hidden', margin:'20px 0' }}>
            <div style={{
              height: '100%',
              width: activeOrder.status === 'PENDING' ? '30%' :
                      activeOrder.status === 'PREPARING' ? '70%' :
                      '100%',
              background: getStatusColor(activeOrder.status),
              transition: 'width 1s ease'
            }} />
          </div>

          <p style={{color:'#666', fontStyle:'italic'}}>
             {activeOrder.status === 'PENDING' ? "Sending request to kitchen..." :
              activeOrder.status === 'PREPARING' ? "Chefs are cooking your meal!" :
              "Order is Ready! Please pay to complete."}
          </p>

          {activeOrder.status === 'PREPARING' && activeOrder.prep_time && (
              <div style={styles.prepBadge}>
                  ⏱️ Ready in approx {activeOrder.prep_time} mins
              </div>
          )}

          {activeOrder.status === 'READY' && (
            <button style={styles.payButton} onClick={openBill}>
              View Bill & Pay
            </button>
          )}
          
          {activeOrder.payment_status === 'PAID' && (
             <div style={{marginTop:'15px', color:'green', fontWeight:'bold', border:'1px solid green', padding:'10px', borderRadius:'8px'}}>
                 ✅ Payment Complete
             </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== RENDER: MAIN MENU ====================
  return (
    <div style={styles.container}>
      {isKitchenBusy() && (
        <div style={styles.busyBanner}>
          ⚠️ Kitchen is busy. Ordering is temporarily paused.
        </div>
      )}
      <style>{`
        .menu-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important; }
        .add-btn:active { transform: scale(0.97); }
        .cat-btn:hover { background-color: #e8eaf6; color: #333; }
        ::-webkit-scrollbar { height: 4px; }
        ::-webkit-scrollbar-thumb { background: #d1d1d1; border-radius: 4px; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>RestoScan</h1>
            <p style={styles.subtitle}>Table {tableNumber} • Fine Dining</p>
          </div>
          <div style={styles.vegToggle} onClick={() => setOnlyVeg(!onlyVeg)}>
            <span style={{marginRight: '10px', fontSize: '0.8em', color: onlyVeg ? '#388E3C' : '#999', fontWeight: '700', letterSpacing:'0.5px'}}>VEG ONLY</span>
            <div style={{ width: '42px', height: '24px', background: onlyVeg ? '#388E3C' : '#ddd', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
              <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: onlyVeg ? '20px' : '2px', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
            </div>
          </div>
        </div>
        <div style={styles.categoriesWrapper}>
          <div style={styles.categories}>
            {sortedTabs.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} style={selectedCategory === cat ? styles.activeTab : styles.tab} className="cat-btn">
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={styles.grid}>
        {filteredMenu.map(item => (
          <div key={item.id} style={styles.card} className="menu-card">
            <div style={styles.imageContainer}>
              <img src={item.image_url || PLACEHOLDER_IMG} onError={(e) => e.target.src = PLACEHOLDER_IMG} alt={item.name} style={styles.foodImage} />
              <div style={{position: 'absolute', top: '10px', right: '10px', background:'white', padding:'4px', borderRadius:'4px', boxShadow:'0 2px 5px rgba(0,0,0,0.2)'}}>
                {item.is_veg ? (
                  <div style={styles.vegIcon}><div style={styles.vegDot}></div></div>
                ) : (
                  <div style={styles.nonVegIcon}><div style={styles.nonVegDot}></div></div>
                )}
              </div>
            </div>

            <div style={styles.cardContent}>
              <div style={{marginBottom: '5px'}}>
                <h3 style={styles.itemName}>{item.name}</h3>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px'}}>
                  <span style={styles.itemPrice}>₹{getPrice(item.price)}</span>
                  <span style={styles.catLabel}>{item.category}</span>
                </div>
              </div>

              {cart[item.id] ? (
                <div style={styles.counter}>
                  <button onClick={() => removeFromCart(item.id)} style={styles.countBtn}>−</button>
                  <span style={{fontWeight:'600', fontSize:'1em'}}>{cart[item.id]}</span>
                  <button onClick={() => addToCart(item)} style={{ ...styles.countBtn }}>+</button>
                </div>
              ) : (
                <button onClick={() => addToCart(item)} style={{ ...(addedItem === item.id ? styles.addedButton : styles.addButton) }} className="add-btn">
                  {addedItem === item.id ? "Added! ✓" : "Add"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalItems > 0 && (
        <div style={styles.floatingCart} onClick={placeOrder}>
          <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
            <div style={{background:'rgba(255,255,255,0.2)', padding:'5px 12px', borderRadius:'8px', fontSize:'0.9em', fontWeight:'600'}}>
              {totalItems} Items
            </div>
            <span style={{fontSize: '1.2em', fontWeight: '600'}}>₹{totalPrice.toFixed(0)}</span>
          </div>
          <div style={{display:'flex', alignItems:'center', fontWeight:'600', fontSize:'1em', letterSpacing:'0.5px'}}>
            {isOrdering ? 'PROCESSING...' : 'VIEW ORDER'} <span style={{marginLeft:'8px'}}>{isOrdering ? '⏳' : '➔'}</span>
          </div>
        </div>
      )}
      <div style={{height: '100px'}}></div>
    </div>
  );
}

// ---------------- STYLES ----------------
const styles = {
  container: { fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', background: '#fdfbf7', minHeight: '100vh', color:'#333' },
  header: { background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 99, borderBottom: '1px solid #eee' },
  topBar: { padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: '1.6em', color: '#2c3e50', fontWeight: '700', letterSpacing: '-0.5px' },
  subtitle: { margin: '2px 0 0 0', color: '#7f8c8d', fontSize: '0.9em' },
  vegToggle: { display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' },
  categoriesWrapper: { paddingBottom: '10px' },
  categories: { display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 25px 10px 25px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' },
  tab: { padding: '8px 18px', borderRadius: '30px', border: '1px solid #e0e0e0', background: 'white', color: '#666', fontSize: '0.9em', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer', transition: '0.2s' },
  activeTab: { padding: '8px 20px', borderRadius: '30px', border: '1px solid #333', background: '#333', color: 'white', fontSize: '0.9em', fontWeight: '600', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
  grid: { padding: '25px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '25px' },
  card: { background: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #f0f0f0', transition: 'all 0.3s ease', cursor: 'pointer' },
  imageContainer: { position: 'relative', height: '160px', background: '#f5f5f5' },
  foodImage: { width: '100%', height: '100%', objectFit: 'cover' },
  cardContent: { padding: '15px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '110px' },
  itemName: { margin: 0, fontSize: '1.05em', fontWeight: '600', color: '#333', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  itemPrice: { fontSize: '1.1em', fontWeight: '700', color: '#2c3e50' },
  catLabel: { fontSize: '0.7em', textTransform: 'uppercase', color: '#aaa', fontWeight: '600', letterSpacing: '0.5px' },
  addButton: { width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#e0f2f1', color: '#00695c', fontWeight: '700', fontSize: '0.9em', cursor: 'pointer', transition: '0.2s' },
  addedButton: { width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#00695c', color: 'white', fontWeight: '700', fontSize: '0.9em', cursor: 'default', transition: '0.2s' },
  counter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#263238', borderRadius: '8px', padding: '6px 10px', color: 'white' },
  countBtn: { background: 'transparent', border: 'none', color: 'white', fontWeight: '400', fontSize: '1.4em', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight:'1' },
  floatingCart: { position: 'fixed', bottom: '25px', left: '25px', right: '25px', background: '#263238', color: 'white', padding: '16px 25px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', cursor: 'pointer', animation: 'slideUp 0.4s ease-out', zIndex: 200 },
  
  // Status & Icons
  vegIcon: { border: '2px solid #2ecc71', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  vegDot: { background: '#2ecc71', width: '8px', height: '8px', borderRadius: '50%' },
  nonVegIcon: { border: '2px solid #c0392b', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nonVegDot: { background: '#c0392b', width: '8px', height: '8px', borderRadius: '50%' },
  busyBanner: { background: '#ffebee', color: '#c62828', padding: '10px', textAlign: 'center', fontWeight: '600', position: 'sticky', top: 0, zIndex: 101 },

  // Status Screen
  statusContainer: { padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fdfbf7' },
  statusCard: { margin: '30px auto', padding: '40px', maxWidth: '380px', borderRadius: '20px', background: 'white', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', border:'1px solid #f0f0f0' },
  payButton: { background: '#333', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '30px', fontSize: '1em', fontWeight: '600', cursor: 'pointer', marginTop: '20px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' },
  prepBadge: { background: '#e3f2fd', color: '#1565c0', padding: '12px 20px', borderRadius: '12px', marginTop: '15px', fontWeight: 'bold', display: 'inline-block', fontSize: '1.1em', boxShadow: '0 4px 10px rgba(33, 150, 243, 0.2)' },

  // BILL MODAL
  billOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  billCard: { background: '#fff', width: '90%', maxWidth: 400, padding: 25, fontFamily: 'monospace', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  closeBillBtn: { width: '100%', marginTop: 20, padding: 12, background: '#333', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '1em', fontWeight: 'bold' },
  
  // PAYMENT BUTTONS
  upiBtn: { padding: 15, background: '#8e44ad', color: 'white', border: 'none', borderRadius: 8, fontSize: '1.1em', cursor: 'pointer', marginBottom: 5 },
  cashBtn: { padding: 15, background: '#27ae60', color: 'white', border: 'none', borderRadius: 8, fontSize: '1.1em', cursor: 'pointer' },
  verifyBtn: { marginTop: 15, padding: 12, background: '#f39c12', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', width: '100%', fontWeight:'bold' },
  backBtn: { marginTop: 10, background: 'transparent', border: 'none', color: '#777', textDecoration: 'underline', cursor: 'pointer' }
};

const getStatusColor = (s) => s==='PENDING'?'#ffb74d':s==='PREPARING'?'#4fc3f7':s==='READY'?'#81c784':'#333';
const getStatusText = (s) => s==='PENDING'?'Sending Order...':s==='PREPARING'?'Chef is Cooking':s==='READY'?'Ready to Serve':s;