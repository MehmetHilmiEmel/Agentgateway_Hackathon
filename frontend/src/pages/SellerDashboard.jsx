// src/pages/SellerDashboard.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getValidToken } from '../utils/auth';

const API = 'http://localhost:8001';
const DB_API = 'http://localhost:8000';

const SellerDashboard = () => {
    const username = localStorage.getItem('username');

    const [products, setProducts] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('products');
    const [chatInput, setChatInput] = useState('');
    const [chatMsgs, setChatMsgs] = useState([
        { role: 'ai', text: `Hello ${username}! You are in the seller panel. Ask me to add products, update stock, or view reports!` }
    ]);
    const [chatLoading, setChatLoading] = useState(false);
    const [form, setForm] = useState({ product_code: '', name: '', price: '', stock: '' });
    const [formMsg, setFormMsg] = useState('');

    const fetchProducts = async () => {
        try {
            const r = await axios.get(`${DB_API}/products/seller/${username}`);
            setProducts(r.data.products || []);
        } catch { setProducts([]); }
    };

    const fetchStats = async () => {
        try {
            const r = await axios.get(`${DB_API}/stats/this_month`);
            setStats(r.data);
        } catch { setStats(null); }
    };

    useEffect(() => {
        Promise.all([fetchProducts(), fetchStats()]).finally(() => setLoading(false));
    }, []);

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
            fetchProducts();
        } catch {
            setChatMsgs(prev => [...prev, { role: 'ai', text: 'An error occurred.' }]);
        } finally { setChatLoading(false); }
    };

    const handleAddProduct = async (e) => {
        e.preventDefault();
        setFormMsg('');
        try {
            const validToken = await getValidToken();
            const res = await axios.post(`${API}/chat`, {
                message: `Add new product: code=${form.product_code}, name="${form.name}", price=${form.price} TL, stock=${form.stock} units, seller=${username}`
            }, { headers: { Authorization: validToken } });
            setFormMsg('✅ ' + res.data.message);
            setForm({ product_code: '', name: '', price: '', stock: '' });
            fetchProducts();
        } catch { setFormMsg('❌ An error occurred.'); }
    };

    const profit = stats ? stats.revenue - stats.cost : 0;

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-gray-950 text-white">
            <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />

            {/* Header */}
            <div className="border-b border-gray-800 px-8 py-5 flex items-center justify-between bg-gray-900/50 backdrop-blur-md">
                <div>
                    <div className="text-xs font-semibold text-emerald-400 tracking-widest uppercase mb-1">Seller Panel</div>
                    <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold text-white">
                        Hello, {username} 👋
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs text-gray-400">AI Assistant Active</span>
                    </div>
                    <button onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                        className="text-xs text-red-400 hover:underline">Logout</button>
                </div>
            </div>

            <div className="flex h-[calc(100vh-73px)]">
                {/* Left panel */}
                <div className="w-72 border-r border-gray-800 bg-gray-900/30 flex flex-col">
                    <div className="p-5 border-b border-gray-800 space-y-3">
                        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-4">
                            <div className="text-xs text-emerald-400 font-semibold mb-1">This Month's Profit</div>
                            <div className="text-2xl font-bold text-emerald-400">
                                {loading ? '...' : `₺${profit.toLocaleString('tr-TR')}`}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gray-800/50 rounded-xl p-3">
                                <div className="text-xs text-gray-500 mb-1">Products</div>
                                <div className="text-xl font-bold">{products.length}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-xl p-3">
                                <div className="text-xs text-gray-500 mb-1">Revenue</div>
                                <div className="text-sm font-bold text-blue-400">
                                    {stats ? `₺${(stats.revenue / 1000).toFixed(0)}K` : '...'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <nav className="p-3 space-y-1">
                        {[
                            { id: 'products', icon: '📦', label: 'My Products' },
                            { id: 'add', icon: '➕', label: 'Add Product' },
                            { id: 'chat', icon: '🤖', label: 'AI Assistant' },
                        ].map(item => (
                            <button key={item.id} onClick={() => setTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === item.id
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                                    }`}>
                                <span>{item.icon}</span>{item.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Right content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* My Products */}
                    {tab === 'products' && (
                        <div>
                            <h2 className="text-lg font-bold mb-5">My Products</h2>
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-800/50 rounded-2xl animate-pulse" />)}
                                </div>
                            ) : products.length === 0 ? (
                                <div className="text-center py-20 text-gray-600">
                                    <div className="text-5xl mb-4">📦</div>
                                    <p>You haven't added any products yet.</p>
                                    <button onClick={() => setTab('add')}
                                        className="mt-4 bg-emerald-500 text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-emerald-400 transition-colors">
                                        Add First Product
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {products.map(p => (
                                        <div key={p.product_code}
                                            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center justify-between hover:border-gray-700 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-2xl">📦</div>
                                                <div>
                                                    <div className="font-semibold">{p.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono mt-0.5">{p.product_code}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 text-sm">
                                                <div className="text-right">
                                                    <div className="text-emerald-400 font-bold">₺{p.price.toLocaleString('tr-TR')}</div>
                                                    <div className="text-gray-500 text-xs">price</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`font-bold ${p.stock < 5 ? 'text-red-400' : 'text-white'}`}>{p.stock}</div>
                                                    <div className="text-gray-500 text-xs">stock</div>
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${p.stock > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {p.stock > 0 ? 'Active' : 'Out of stock'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Add Product */}
                    {tab === 'add' && (
                        <div className="max-w-lg">
                            <h2 className="text-lg font-bold mb-6">Add New Product</h2>
                            <form onSubmit={handleAddProduct} className="space-y-4">
                                {[
                                    { key: 'product_code', label: 'Product Code', placeholder: 'e.g: APL-PHN-016' },
                                    { key: 'name', label: 'Product Name', placeholder: 'e.g: iPhone 16 Pro' },
                                    { key: 'price', label: 'Price (TL)', placeholder: 'e.g: 75000', type: 'number' },
                                    { key: 'stock', label: 'Stock Quantity', placeholder: 'e.g: 10', type: 'number' },
                                ].map(field => (
                                    <div key={field.key}>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">{field.label}</label>
                                        <input
                                            type={field.type || 'text'}
                                            placeholder={field.placeholder}
                                            value={form[field.key]}
                                            onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            required
                                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                                        />
                                    </div>
                                ))}
                                {formMsg && (
                                    <div className={`text-sm px-4 py-3 rounded-xl ${formMsg.startsWith('✅') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {formMsg}
                                    </div>
                                )}
                                <button type="submit"
                                    className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl hover:bg-emerald-400 transition-colors">
                                    Add Product
                                </button>
                            </form>
                        </div>
                    )}

                    {/* AI Chat */}
                    {tab === 'chat' && (
                        <div className="flex flex-col h-full max-h-[calc(100vh-140px)]">
                            <h2 className="text-lg font-bold mb-4">AI Assistant</h2>
                            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                                {chatMsgs.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${msg.role === 'user'
                                            ? 'bg-emerald-500 text-black rounded-tr-sm'
                                            : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="flex gap-1 px-4 py-3 bg-gray-800 rounded-2xl w-fit">
                                        {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                                    placeholder="Update stock, delete product, ask for report..."
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                                />
                                <button onClick={sendChat}
                                    className="bg-emerald-500 text-black px-5 rounded-xl font-bold hover:bg-emerald-400 transition-colors">
                                    ↑
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SellerDashboard;