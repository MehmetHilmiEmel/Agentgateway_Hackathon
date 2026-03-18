// src/components/Login.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const API = import.meta.env.VITE_CORE_API_URL || 'http://localhost:8000';

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API}/login`, { username, password });

            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('refresh_token', res.data.refresh_token);
            localStorage.setItem('token_exp', Date.now() + (res.data.expires_in * 1000));
            localStorage.setItem('username', username);

            window.location.href = "/";
        } catch {
            setError("Login failed. Check your information.");
        }
    };

    return (
        <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl border border-gray-100">
            <h2 className="text-3xl font-black mb-6 text-gray-800">Welcome Back!</h2>
            <form onSubmit={handleLogin} className="space-y-4">
                <input className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Username" onChange={e => setUsername(e.target.value)} />
                <input className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                    type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" className="w-full bg-black text-white p-4 rounded-2xl font-bold hover:bg-gray-800 transition-all">
                    Login
                </button>
            </form>
        </div>
    );
};

export default Login;