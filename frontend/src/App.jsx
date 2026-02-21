// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './pages/Dashboard';
import SellerDashboard from './pages/SellerDashboard';
import BuyerDashboard from './pages/BuyerDashboard';

// Token helpers
const decodeToken = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return null; }
};
const getUserRoles = () => {
  const token = localStorage.getItem('token');
  if (!token) return [];
  return decodeToken(token)?.realm_access?.roles || [];
};
export const isAdmin = () => getUserRoles().includes('admin');
export const isSeller = () => getUserRoles().includes('seller');
export const isBuyer = () => getUserRoles().includes('buyer');

// Redirect after login based on role
const HomeRedirect = () => {
  const token = localStorage.getItem('token');
  if (!token) return <PublicHome />;
  if (isAdmin()) return <Navigate to="/admin" replace />;
  if (isSeller()) return <Navigate to="/seller" replace />;
  if (isBuyer()) return <Navigate to="/buyer" replace />;
  return <PublicHome />;
};

// Unauthenticated home page
const PublicHome = () => (
  <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
    <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tighter">
      MCP<span className="text-blue-600">.STORE</span>
    </h1>
    <p className="text-gray-500 text-lg mb-10 max-w-md">
      E-commerce platform powered by AgentGateway & Gemini AI.
    </p>
    <div className="flex gap-4">
      <Link to="/login"
        className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition-colors">
        Log In
      </Link>
      <Link to="/register"
        className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition-colors">
        Sign Up
      </Link>
    </div>
  </div>
);

// Protection HOCs
const ProtectedRoute = ({ children, check }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  if (!check()) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/home" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/seller" element={<ProtectedRoute check={isSeller}><SellerDashboard /></ProtectedRoute>} />
        <Route path="/buyer" element={<ProtectedRoute check={isBuyer}><BuyerDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute check={isAdmin}><Dashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;