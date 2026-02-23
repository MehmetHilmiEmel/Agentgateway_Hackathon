// src/pages/BuyerDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getValidToken } from '../utils/auth';

const API = 'http://localhost:8001';
const DB_API = 'http://localhost:8000';

const BuyerDashboard = () => {
    const username = localStorage.getItem('username');

    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({ items: [], total: 0 });
    const [orders, setOrders] = useState([]);
    const [tab, setTab] = useState('shop');
    const [loading, setLoading] = useState(true);
    const [chatInput, setChatInput] = useState('');
    const [chatMsgs, setChatMsgs] = useState([
        { role: 'ai', text: `Hello ${username}! I'm your shopping assistant. Ask questions about products, add to your cart, or place an order!` }
    ]);
    const [chatLoading, setChatLoading] = useState(false);
    const [notification, setNotification] = useState('');
    const scrollRef = useRef(null);

    const showNotif = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(''), 3000);
    };

    const fetchProducts = async () => {
        try {
            const r = await axios.get(`${DB_API}/products`);
            setProducts(r.data.products || []);
        } catch { setProducts([]); }
    };

    const fetchCart = async () => {
        try {
            const r = await axios.get(`${DB_API}/cart/${username}`);
            setCart(r.data);
        } catch { setCart({ items: [], total: 0 }); }
    };

    const fetchOrders = async () => {
        try {
            const r = await axios.get(`${DB_API}/orders/${username}`);
            setOrders(r.data.orders || []);
        } catch { setOrders([]); }
    };

    useEffect(() => {
        Promise.all([fetchProducts(), fetchCart(), fetchOrders()]).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMsgs]);

    const addToCart = async (product) => {
        try {
            await axios.post(`${DB_API}/cart`, {
                username, product_code: product.product_code, quantity: 1
            });
            fetchCart();
            showNotif(`✅ ${product.name} added to cart`);
        } catch (e) {
            showNotif('❌ ' + (e.response?.data?.detail || 'An error occurred'));
        }
    };

    const removeFromCart = async (product_code) => {
        try {
            await axios.delete(`${DB_API}/cart/${username}/${product_code}`);
            fetchCart();
        } catch { }
    };

    const checkout = async () => {
        try {
            const r = await axios.post(`${DB_API}/cart/${username}/checkout`);
            showNotif('🎉 ' + r.data.message);
            fetchCart();
            fetchOrders();
            setTab('orders');
        } catch (e) {
            showNotif('❌ ' + (e.response?.data?.detail || 'Error'));
        }
    };

    const sendChat = async () => {
        if (!chatInput.trim()) return;
        const msg = chatInput;
        setChatMsgs(prev => [...prev, { role: 'user', text: msg }]);
        setChatInput('');
        setChatLoading(true);
        try {
            const validToken = await getValidToken();
            const res = await axios.post(`${API}/chat`,
                { message: msg },
                { headers: { Authorization: validToken } }
            );
            setChatMsgs(prev => [...prev, { role: 'ai', text: res.data.message }]);
            fetchCart();
            fetchOrders();
        } catch {
            setChatMsgs(prev => [...prev, { role: 'ai', text: 'An error occurred.' }]);
        } finally { setChatLoading(false); }
    };

    const cartCount = cart.items?.reduce((s, i) => s + i.quantity, 0) || 0;

    return (
        <div className="min-h-screen bg-slate-50 text-gray-900" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Syne:wght@500;600;700;800&display=swap" rel="stylesheet" />

            {notification && (
                <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl">
                    {notification}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div style={{ fontFamily: "'Syne', sans-serif" }} className="text-xl font-bold">
                    MCP<span className="text-blue-600">.STORE</span>
                </div>
                <div className="flex items-center gap-2">
                    {[
                        { id: 'shop', label: '🛍️ Store' },
                        { id: 'orders', label: '📦 My Orders' },
                        { id: 'chat', label: '🤖 AI Assistant' },
                    ].map(item => (
                        <button key={item.id} onClick={() => setTab(item.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === item.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                                }`}>
                            {item.label}
                        </button>
                    ))}
                    <button onClick={() => setTab('cart')}
                        className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === 'cart' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                            }`}>
                        🛒 Cart
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                        {username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{username}</span>
                    <button onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                        className="text-xs text-red-400 hover:underline">Logout</button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* SHOP */}
                {tab === 'shop' && (
                    <div>
                        <div className="mb-8">
                            <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-4xl font-bold text-gray-900 mb-2">Discover</h1>
                            <p className="text-gray-500">Explore the newest products, add them to your cart.</p>
                        </div>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[1, 2, 3].map(i => <div key={i} className="h-72 bg-gray-100 rounded-3xl animate-pulse" />)}
                            </div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <div className="text-5xl mb-3">📭</div>
                                <p>No products yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {products.map(p => (
                                    <div key={p.product_code}
                                        className="bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                        <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                                            <span className="text-6xl group-hover:scale-110 transition-transform duration-300">📦</span>
                                        </div>
                                        <div className="p-5">
                                            <div className="text-xs font-mono text-gray-400 mb-1">{p.product_code}</div>
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight">{p.name}</h3>
                                            <div className="flex items-end justify-between mt-4">
                                                <div>
                                                    <div className="text-2xl font-black text-blue-600">
                                                        ${p.price.toLocaleString('en-US')}
                                                    </div>
                                                    <div className={`text-xs mt-0.5 font-medium ${p.stock < 5 ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {p.stock > 0 ? `${p.stock} units in stock` : 'Out of stock'}
                                                    </div>
                                                </div>
                                                <button onClick={() => addToCart(p)} disabled={p.stock === 0}
                                                    className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                                    + Cart
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* CART */}
                {tab === 'cart' && (
                    <div className="max-w-2xl">
                        <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-bold mb-6">My Cart</h1>
                        {!cart.items || cart.items.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <div className="text-6xl mb-4">🛒</div>
                                <p className="font-medium text-gray-500">Your cart is empty</p>
                                <button onClick={() => setTab('shop')}
                                    className="mt-5 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-colors">
                                    Start Shopping
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="space-y-3 mb-6">
                                    {cart.items.map(item => (
                                        <div key={item.product_code}
                                            className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">📦</div>
                                                <div>
                                                    <div className="font-semibold text-gray-900">{item.name}</div>
                                                    <div className="text-sm text-gray-400 mt-0.5">
                                                        {item.quantity} units × ${item.price?.toLocaleString('en-US')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="font-black text-gray-900 text-lg">
                                                    ${item.subtotal?.toLocaleString('en-US')}
                                                </div>
                                                <button onClick={() => removeFromCart(item.product_code)}
                                                    className="w-8 h-8 bg-red-50 text-red-400 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors text-xl font-light">
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-5">
                                        <span className="text-gray-600 font-medium">Total Amount</span>
                                        <span className="text-3xl font-black text-blue-600">
                                            ${cart.total?.toLocaleString('en-US')}
                                        </span>
                                    </div>
                                    <button onClick={checkout}
                                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-95 transition-all">
                                        Complete Order →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ORDERS */}
                {tab === 'orders' && (
                    <div className="max-w-2xl">
                        <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-bold mb-6">My Orders</h1>
                        {orders.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <div className="text-6xl mb-4">📦</div>
                                <p>You haven't placed any orders yet.</p>
                                <button onClick={() => setTab('shop')}
                                    className="mt-5 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-colors">
                                    Start Shopping
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orders.map((o, i) => (
                                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-xl">✅</div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{o.product_name}</div>
                                                <div className="text-sm text-gray-400 mt-0.5">
                                                    {o.quantity} units • {new Date(o.created_at).toLocaleDateString('en-US')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-blue-600 text-lg">
                                                ${o.total_price?.toLocaleString('en-US')}
                                            </div>
                                            <div className="text-xs text-emerald-500 font-semibold mt-0.5">Completed</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* AI CHAT */}
                {tab === 'chat' && (
                    <div className="max-w-2xl">
                        <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-bold mb-2">AI Shopping Assistant</h1>
                        <p className="text-gray-500 text-sm mb-6">Ask about products, add to cart, order — all by talking.</p>
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="h-96 overflow-y-auto p-5 space-y-3 bg-gray-50/50">
                                {chatMsgs.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-sm'
                                            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="flex gap-1 px-4 py-3 bg-white rounded-2xl w-fit border border-gray-100 shadow-sm">
                                        {[0, 1, 2].map(i => (
                                            <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                                                style={{ animationDelay: `${i * 0.15}s` }} />
                                        ))}
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                            <div className="border-t border-gray-100 p-4 flex gap-2 bg-white">
                                <input
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Ask about products, add to cart, order..."
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                                />
                                <button onClick={sendChat}
                                    className="bg-blue-600 text-white px-5 rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all">
                                    ↑
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BuyerDashboard;