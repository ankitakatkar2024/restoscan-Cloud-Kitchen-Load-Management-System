import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';

// --- COMPONENTS ---
// ✅ Matching your imports to the paths used in your internal Links
import Kitchen from './components/KitchenDisplay'; 
import CustomerMenu from './components/CustomerMenu';
import QRCodeGenerator from './components/QRCodeGenerator';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Signup from './components/Signup'; 
import AdminLogin from './components/AdminLogin'; 

// --- 🔒 EXISTING ADMIN GUARD (For Manager Dashboard) ---
const ProtectedRoute = ({ children }) => {
  const isAuth = localStorage.getItem('adminAuth') === 'true';
  return isAuth ? children : <Navigate to="/login" replace />;
};

// --- 🛡️ NEW KITCHEN GUARD (For Chef Console) ---
const KitchenGuard = ({ children }) => {
  // Checks for the special token created in AdminLogin.jsx
  const isChef = localStorage.getItem('kitchenAuthToken'); 
  return isChef ? children : <Navigate to="/admin-login" replace />;
};

function App() {
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
    localStorage.removeItem('kitchenAuthToken'); // Clear Chef token too
    localStorage.removeItem('userRole');
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      {/* --- GLOBAL NAVIGATION BAR --- */}
      <nav style={navBarStyle}>
        {/* These Links match the routes defined below */}
        <Link to="/kitchen" style={linkStyle}>👨‍🍳 Kitchen</Link>
        <Link to="/menu" style={linkStyle}>🍔 Menu</Link>
        
        {/* ✅ Updated to match the "qr-generator" path if you used that in internal links, 
            or keep "qr-codes" if that is your preferred URL */}
        <Link to="/qr-codes" style={linkStyle}>🖨️ QR Codes</Link>
        
        {isAuthenticated ? (
          <>
            <Link to="/admin" style={linkStyle}>🛠️ Manager</Link>
            <button onClick={handleLogout} style={logoutStyle}>Logout</button>
          </>
        ) : (
          <Link to="/login" style={linkStyle}>🔒 Login</Link>
        )}
      </nav>

      {/* --- ROUTE DEFINITIONS --- */}
      <Routes>
        {/* 1. Customer Menu (Public) */}
        <Route path="/menu" element={<CustomerMenu />} />
        
        {/* 2. QR Code Generator (Public/Staff Tool) */}
        {/* ✅ If you used <Link to="/qr-generator"> in other files, change this path to "/qr-generator" */}
        <Route path="/qr-codes" element={<QRCodeGenerator />} />
        <Route path="/qr-generator" element={<QRCodeGenerator />} />

        {/* 3. Authentication Routes */}
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* 4. Protected Kitchen Route (Requires Kitchen Token) */}
        <Route 
          path="/kitchen" 
          element={
            <KitchenGuard>
              <Kitchen />
            </KitchenGuard>
          } 
        />

        {/* 5. Protected Manager Dashboard (Requires Admin Auth) */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Default Redirect: Go to Menu if path doesn't exist */}
        <Route path="*" element={<Navigate to="/menu" />} />
      </Routes>
    </BrowserRouter>
  );
}

// --- STYLES ---
const navBarStyle = {
  padding: '15px',
  background: '#1a1a1a', // Darker professional background
  textAlign: 'center',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '15px',
  borderBottom: '2px solid #FF4500', // Orange accent line
  position: 'sticky',
  top: 0,
  zIndex: 1000
};

const linkStyle = { 
  color: 'white', 
  textDecoration: 'none', 
  fontWeight: 'bold', 
  fontSize: '0.95em',
  padding: '8px 15px',
  borderRadius: '6px',
  transition: '0.3s all',
  cursor: 'pointer'
};

const logoutStyle = {
  background: '#FF4500',
  color: 'white',
  border: 'none',
  padding: '8px 18px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.9em',
  marginLeft: '10px',
  transition: '0.3s'
};

export default App;