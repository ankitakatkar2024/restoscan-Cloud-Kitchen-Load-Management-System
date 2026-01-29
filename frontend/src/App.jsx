import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';

// --- COMPONENTS ---
// ✅ FIX: Import from "KitchenDisplay" (Your actual filename)
import Kitchen from './components/KitchenDisplay'; 
import CustomerMenu from './components/CustomerMenu';
import QRCodeGenerator from './components/QRCodeGenerator';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Signup from './components/Signup'; 
import AdminLogin from './components/AdminLogin'; 

// --- 🔒 EXISTING ADMIN GUARD (For Dashboard) ---
const ProtectedRoute = ({ children }) => {
  const isAuth = localStorage.getItem('adminAuth') === 'true';
  return isAuth ? children : <Navigate to="/login" replace />;
};

// --- 🛡️ NEW KITCHEN GUARD (For Chef Only) ---
const KitchenGuard = ({ children }) => {
  // Checks for the special token created in AdminLogin.jsx
  const isChef = localStorage.getItem('kitchenAuthToken'); 
  return isChef ? children : <Navigate to="/admin-login" replace />;
};

function App() {
  // Existing State for General Admin
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('adminAuth') === 'true'
  );

  const handleLogin = (status) => {
    setIsAuthenticated(status);
    if (status) localStorage.setItem('adminAuth', 'true');
    else localStorage.removeItem('adminAuth');
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('userRole');
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      {/* --- NAVIGATION BAR --- */}
      <nav style={{ padding: '15px', background: '#222', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '20px', borderBottom: '1px solid #444' }}>
        {/* Updated Kitchen Link points to protected route */}
        <Link to="/kitchen" style={linkStyle}>👨‍🍳 Kitchen</Link>
        <Link to="/menu" style={linkStyle}>🍔 Menu</Link>
        <Link to="/qr-codes" style={linkStyle}>🖨️ QR Codes</Link>
        
        {/* General Admin Links */}
        {isAuthenticated ? (
           <>
             <Link to="/admin" style={linkStyle}>🛠️ Manager</Link>
             <button onClick={handleLogout} style={logoutStyle}>Logout</button>
           </>
        ) : (
             <Link to="/login" style={linkStyle}>🔒 Manager Login</Link>
        )}
      </nav>

      {/* --- ROUTE DEFINITIONS --- */}
      <Routes>
        {/* 1. Public Customer Route */}
        <Route path="/menu" element={<CustomerMenu />} />
        
        {/* 2. Public Tools */}
        <Route path="/qr-codes" element={<QRCodeGenerator />} />
        
        {/* 3. General Auth Routes (Managers/Users) */}
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/signup" element={<Signup />} />

        {/* 4. ✅ NEW: Chef Login Page (Hidden) */}
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* 5. ✅ NEW: Protected Kitchen Route */}
        <Route 
          path="/kitchen" 
          element={
            <KitchenGuard>
              <Kitchen />
            </KitchenGuard>
          } 
        />

        {/* 6. Existing Protected Admin Dashboard */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Default Redirect */}
        <Route path="*" element={<Navigate to="/menu" />} />
      </Routes>
    </BrowserRouter>
  );
}

// --- STYLES ---
const linkStyle = { 
  color: 'white', 
  textDecoration: 'none', 
  fontWeight: 'bold', 
  fontSize: '1.1em',
  padding: '8px 12px',
  borderRadius: '5px',
  transition: 'background 0.2s'
};

const logoutStyle = {
  background: '#e74c3c',
  color: 'white',
  border: 'none',
  padding: '8px 15px',
  borderRadius: '5px',
  cursor: 'pointer',
  fontWeight: 'bold',
  marginLeft: '10px'
};

export default App;