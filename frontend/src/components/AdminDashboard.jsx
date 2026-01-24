import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';

// ⚠️ YOUR NETWORK IP
const API_URL = 'http://10.118.124.153:5000';

// ✅ FIX: Working placeholder for broken images
const PLACEHOLDER_IMG = 'https://placehold.co/150';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, orders: 0, activeTables: 0, topItem: 'N/A', cash: 0, upi: 0 });
  const [revenueData, setRevenueData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  
  const [filterMode, setFilterMode] = useState('TODAY'); 
  const [activeModal, setActiveModal] = useState(null);
  const [formData, setFormData] = useState({ id: null, name: '', price: '', category: 'Mains', image_url: '', is_veg: true });

  const COLORS = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ecf0f1'];

  useEffect(() => {
    fetchData();
    const socket = io(API_URL);
    socket.on('new_order', fetchData);
    socket.on('payment_updated', fetchData); 
    
    const interval = setInterval(fetchData, 15000); 
    return () => {
        clearInterval(interval);
        socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (orders.length > 0 && menuItems.length > 0) {
        processData(orders, menuItems, filterMode);
    }
  }, [filterMode, orders, menuItems]);

  const fetchData = async () => {
    try {
      const [menuRes, orderRes] = await Promise.all([
        axios.get(`${API_URL}/api/menu`),
        axios.get(`${API_URL}/api/orders/history`)
      ]);
      setMenuItems(menuRes.data);
      const sortedOrders = orderRes.data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(sortedOrders);
    } catch (err) { console.error("Load Error:", err); }
  };

  // ✅ FIX: Smart Verify Function
  // It now accepts the whole 'order' object, not just the ID.
  const verifyPayment = async (order) => {
    // If method is missing (null), assume it is CASH
    const methodToUse = order.payment_method || 'CASH'; 
    
    if(window.confirm(`Confirm payment of ₹${order.total_price} via ${methodToUse}?`)) {
        try {
            // 1. If the order had no method, we force-update it to CASH first
            if (!order.payment_method) {
                await axios.put(`${API_URL}/api/orders/${order.id}/request-payment`, { method: 'CASH' });
            }
            
            // 2. Mark as Paid
            await axios.put(`${API_URL}/api/orders/${order.id}/pay`);
            
            // 3. Refresh Data
            fetchData(); 
        } catch(err) {
            alert("Error verifying payment. Check backend connection.");
            console.error(err);
        }
    }
  };

  const processData = (allOrders, menu, mode) => {
    let filteredOrders = [];
    const now = new Date();
    const todayStr = now.toDateString();
    
    filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        if (mode === 'TODAY') return orderDate.toDateString() === todayStr;
        if (mode === 'WEEK') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            return orderDate >= sevenDaysAgo;
        } 
        if (mode === 'MONTH') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            return orderDate >= thirtyDaysAgo;
        }
        return true; 
    });

    let totalRev = 0, cash = 0, upi = 0;
    let itemCounts = {};
    let categoryCounts = {};
    let graphMap = {}; 

    if (mode === 'TODAY') {
        for(let i=9; i<=23; i++) graphMap[`${i}:00`] = 0;
    }

    filteredOrders.forEach(order => {
        const orderTotal = parseFloat(order.total_price) || 0;
        
        if(order.payment_status === 'PAID') {
            totalRev += orderTotal;
            
            // ✅ NOW THIS WILL WORK because verifyPayment sets the method correctly
            if(order.payment_method === 'CASH') cash += orderTotal;
            if(order.payment_method === 'UPI') upi += orderTotal;

            const orderDate = new Date(order.created_at);
            let key;
            if (mode === 'TODAY') {
                key = `${orderDate.getHours()}:00`;
                if (graphMap[key] !== undefined) graphMap[key] += orderTotal;
            } else {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                key = `${months[orderDate.getMonth()]} ${orderDate.getDate()}`;
                graphMap[key] = (graphMap[key] || 0) + orderTotal;
            }
        }

        let items = [];
        try {
            items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        } catch (e) { items = []; }

        if(Array.isArray(items)){
            items.forEach(i => {
                const qty = i.quantity || i.qty || 1;
                itemCounts[i.name] = (itemCounts[i.name] || 0) + qty;
                const menuItem = menu.find(m => m.name === i.name);
                const cat = menuItem ? menuItem.category : 'Other';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });
        }
    });

    const topItem = Object.keys(itemCounts).reduce((a, b) => itemCounts[a] > itemCounts[b] ? a : b, "N/A");

    setStats({
        revenue: totalRev,
        cash, 
        upi,
        orders: filteredOrders.length,
        activeTables: allOrders.filter(o => o.status !== 'COMPLETED').length,
        topItem
    });

    let chartData = Object.keys(graphMap).map(k => ({ label: k, sales: graphMap[k] }));
    if (mode !== 'TODAY') {
       chartData.sort((a, b) => new Date(a.label + ` ${now.getFullYear()}`) - new Date(b.label + ` ${now.getFullYear()}`));
    }

    setRevenueData(chartData);
    setCategoryData(Object.keys(categoryCounts).map(c => ({ name: c, value: categoryCounts[c] })));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const payload = { ...formData, price: parseFloat(formData.price) };
    const req = activeModal === 'ADD' ? axios.post(`${API_URL}/api/menu`, payload) : axios.put(`${API_URL}/api/menu/${formData.id}`, payload);
    req.then(() => { alert("Saved!"); fetchData(); closeModal(); }).catch(() => alert("Error saving"));
  };

  const handleDelete = (id) => {
    if(window.confirm("Delete item?")) axios.delete(`${API_URL}/api/menu/${id}`).then(fetchData);
  };

  const closeModal = () => setActiveModal(null);
  const openAdd = () => { setFormData({ id: null, name: '', price: '', category: 'Mains', image_url: '', is_veg: true }); setActiveModal('ADD'); };
  const openEdit = (item) => { setFormData({ ...item, is_veg: item.is_veg === 1 || item.is_veg === true }); setActiveModal('EDIT'); };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div><h1 style={{margin:0, fontSize: '1.5em', color:'white'}}>📊 MANAGER CONSOLE</h1><div style={{fontSize:'0.8em', color:'#888', marginTop:4}}>Real-time Business Overview</div></div>
        <div style={styles.filterBar}>
            {['TODAY', 'WEEK', 'MONTH', 'ALL'].map(mode => (
                <button key={mode} onClick={() => setFilterMode(mode)} style={filterMode === mode ? styles.activeFilter : styles.filterBtn}>
                  {mode === 'ALL' ? 'All Time' : mode === 'TODAY' ? 'Today' : `Last ${mode === 'WEEK' ? '7' : '30'} Days`}
                </button>
            ))}
        </div>
      </header>

      <div style={styles.content}>
        {/* KPI CARDS */}
        <div style={styles.kpiGrid}>
            <div style={styles.card}>
                <div style={styles.kpiLabel}>{filterMode} REVENUE</div>
                <div style={{...styles.kpiValue, color:'#2ecc71'}}>₹{stats.revenue.toLocaleString('en-IN')}</div>
            </div>
            <div style={{...styles.card, borderLeft:'4px solid #f1c40f'}}>
                <div style={styles.kpiLabel}>CASH</div>
                <div style={{...styles.kpiValue}}>₹{stats.cash.toLocaleString('en-IN')}</div>
            </div>
            <div style={{...styles.card, borderLeft:'4px solid #3498db'}}>
                <div style={styles.kpiLabel}>UPI</div>
                <div style={{...styles.kpiValue}}>₹{stats.upi.toLocaleString('en-IN')}</div>
            </div>
            <div style={styles.card}>
                <div style={styles.kpiLabel}>TOP ITEM</div>
                <div style={{...styles.kpiValue, fontSize:'1.1em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{stats.topItem}</div>
            </div>
        </div>

        {/* ORDER HISTORY TABLE */}
        <div style={styles.card}>
            <h3>📋 Payment Verification & History</h3>
            <div style={{overflowX:'auto'}}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Table</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.slice(0, 10).map(order => (
                            <tr key={order.id} style={{borderBottom:'1px solid #333'}}>
                                <td>#{order.id}</td>
                                <td>{order.customer_name}</td>
                                <td style={{fontWeight:'bold'}}>₹{order.total_price}</td>
                                <td>
                                    {order.payment_method === 'UPI' ? <span style={styles.tagUpi}>UPI</span> : 
                                     order.payment_method === 'CASH' ? <span style={styles.tagCash}>CASH</span> : '-'}
                                </td>
                                <td>
                                    {order.payment_status === 'PAID' 
                                     ? <span style={{color:'#2ecc71'}}>✅ PAID</span> 
                                     : <span style={{color:'#e74c3c'}}>⏳ PENDING</span>}
                                </td>
                                <td>
                                    {order.payment_status !== 'PAID' && (
                                        // ✅ FIX: Pass entire 'order' object here
                                        <button style={styles.verifyBtn} onClick={() => verifyPayment(order)}>
                                            Verify
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <br/>

        {/* CHARTS */}
        <div style={styles.mainGrid}>
            <div style={styles.card}>
                <h3>📈 Revenue Trend ({filterMode === 'TODAY' ? 'Hourly' : 'Daily'})</h3>
                <div style={{height:300, width:'100%', display:'flex', justifyContent:'center', alignItems:'center'}}>
                    {revenueData.length > 0 && stats.revenue > 0 ? (
                        <ResponsiveContainer>
                            <AreaChart data={revenueData}>
                                <defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3498db" stopOpacity={0.4}/><stop offset="95%" stopColor="#3498db" stopOpacity={0}/></linearGradient></defs>
                                <Area type="monotone" dataKey="sales" stroke="#3498db" fillOpacity={1} fill="url(#colorSales)"/>
                                <CartesianGrid stroke="#333" strokeDasharray="3 3"/>
                                <XAxis dataKey="label" stroke="#777" fontSize={11} tick={{fill:'#777'}}/>
                                <YAxis stroke="#777" fontSize={11} tick={{fill:'#777'}}/>
                                <Tooltip contentStyle={{backgroundColor:'#222222', border:'1px solid #444', borderRadius:'8px', color:'white'}} itemStyle={{color:'#3498db'}}/>
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{color:'#666', fontStyle:'italic'}}>No Sales Data for this Period</div>
                    )}
                </div>
            </div>
            <div style={styles.card}>
                <h3>🍕 Category Mix ({filterMode})</h3>
                <div style={{height:300, width:'100%', display:'flex', justifyContent:'center', alignItems:'center'}}>
                    {categoryData.length > 0 ? (
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                                    {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Legend verticalAlign="bottom" height={36}/>
                                <Tooltip contentStyle={{backgroundColor:'#328491', border:'1px solid #444', borderRadius:'8px', color:'white'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{color:'#666', fontStyle:'italic'}}>No Data Available</div>
                    )}
                </div>
            </div>
        </div>

        {/* MENU MANAGEMENT */}
        <div style={styles.card}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div><h3 style={{margin:0}}>🍔 Menu Manager</h3><div style={{fontSize:'0.8em', color:'#888', marginTop:5}}>Add, edit or hide items instantly</div></div>
                <div style={{display:'flex', gap:10}}>
                    <button onClick={() => setActiveModal('LIST')} style={{...styles.btn, background:'#333', border:'1px solid #555'}}>View List</button>
                    <button onClick={openAdd} style={styles.btn}>+ Add Item</button>
                </div>
            </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {(activeModal === 'ADD' || activeModal === 'EDIT') && (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h2>{activeModal === 'ADD' ? 'Add Item' : 'Edit Item'}</h2>
                <form onSubmit={handleSave} style={{display:'flex', flexDirection:'column', gap:15}}>
                    <input style={styles.input} placeholder="Name" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} required/>
                    <div style={{display:'flex', gap:10}}>
                        <input style={{...styles.input, flex:1}} placeholder="Price" type="number" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} required/>
                        <select style={{...styles.input, flex:1}} value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                           {['Mains','Starters','Breakfast','Desserts','Beverages'].map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <input style={styles.input} placeholder="Image URL" value={formData.image_url} onChange={e=>setFormData({...formData, image_url:e.target.value})}/>
                    <label style={{color:'white', display:'flex', gap:10}}><input type="checkbox" checked={formData.is_veg} onChange={e=>setFormData({...formData, is_veg:e.target.checked})}/> Veg?</label>
                    <div style={{display:'flex', gap:10}}><button style={styles.saveBtn}>Save</button><button style={styles.cancelBtn} type="button" onClick={closeModal}>Cancel</button></div>
                </form>
            </div>
        </div>
      )}

      {activeModal === 'LIST' && (
        <div style={styles.overlay}>
            <div style={{...styles.modal, width:'600px', maxHeight:'80vh', display:'flex', flexDirection:'column'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}><h2>Menu List</h2><button onClick={closeModal} style={{background:'none', border:'none', color:'white', fontSize:'1.5em', cursor:'pointer'}}>×</button></div>
                <div style={{overflowY:'auto', flex:1}}>
                    {menuItems.map(i => (
                        <div key={i.id} style={styles.listItem}>
                            <div style={{display:'flex', alignItems:'center', gap:15}}>
                                {/* ✅ FIX: Image with Fallback to prevent crash */}
                                <img 
                                    src={i.image_url || PLACEHOLDER_IMG} 
                                    onError={(e) => e.target.src = PLACEHOLDER_IMG}
                                    alt="" 
                                    style={{width:40, height:40, borderRadius:5, background:'#333', objectFit:'cover'}}
                                />
                                <div><div style={{fontWeight:'bold'}}>{i.name}</div><div style={{fontSize:'0.8em', color:'#aaa'}}>{i.category}</div></div>
                            </div>
                            <div style={{display:'flex', alignItems:'center', gap:15}}>
                                <span style={{fontWeight:'bold', color:'#2ecc71'}}>₹{i.price}</span>
                                <button onClick={()=>openEdit(i)} style={styles.iconBtn}>✏️</button>
                                <button onClick={()=>handleDelete(i.id)} style={{...styles.iconBtn, color:'#e74c3c'}}>🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- DARK BLACK STYLES ---
const styles = {
  container: { background: '#111', minHeight: '100vh', color: 'white', fontFamily: '"Segoe UI", sans-serif' },
  header: { padding: '20px 40px', background: '#222', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  filterBar: { display: 'flex', gap: '8px', background: '#111', padding: '5px', borderRadius: '8px' },
  filterBtn: { background: 'transparent', border: 'none', color: '#888', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em', fontWeight: '600' },
  activeFilter: { background: '#333', border: '1px solid #555', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em', fontWeight: '600' },
  content: { padding: '40px', maxWidth: '1400px', margin: '0 auto' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' },
  card: { background: '#222', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', border: '1px solid #333' },
  kpiLabel: { fontSize: '0.85em', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' },
  kpiValue: { fontSize: '2em', fontWeight: 'bold', marginTop: '8px' },
  mainGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginBottom: '30px' },
  btn: { padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9em' },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2em' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: '#222', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', border: '1px solid #333' },
  input: { padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#111', color: 'white', fontSize: '1em', outline: 'none' },
  saveBtn: { flex: 1, padding: '12px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  cancelBtn: { flex: 1, padding: '12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  listItem: { padding: '15px', background: '#111', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', borderRadius: '10px', border: '1px solid #333', alignItems: 'center' },
  
  // Table Styles
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 15 },
  tagUpi: { background: '#3498db', padding: '2px 8px', borderRadius: 4, fontSize: '0.8em', fontWeight:'bold' },
  tagCash: { background: '#f1c40f', color:'black', padding: '2px 8px', borderRadius: 4, fontSize: '0.8em', fontWeight:'bold' },
  verifyBtn: { background: '#e67e22', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color:'white' }
};