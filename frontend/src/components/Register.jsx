// src/components/Register.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Register = () => {
    const [formData, setFormData] = useState({ username: '', password: '', email: '', firstName: '', lastName: '', role: 'buyer' });
    const [status, setStatus] = useState('');
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:8000/register', formData);
            setStatus("Success! Redirecting to login page...");
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setStatus("An error occurred during registration.");
        }
    };


    return (
        <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <h2 className="text-3xl font-black mb-6 text-gray-800">Create a New Account</h2>
            <form onSubmit={handleRegister} className="space-y-4">
                <input className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Username" onChange={e => setFormData({ ...formData, username: e.target.value })} />
                <input className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    type="password" placeholder="Password" onChange={e => setFormData({ ...formData, password: e.target.value })} />
                <input className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Email" onChange={e => setFormData({ ...formData, email: e.target.value })} />
                <div className="flex gap-2">
                    <input className="w-1/2 p-3 bg-gray-50 rounded-xl" placeholder="First Name" onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                    <input className="w-1/2 p-3 bg-gray-50 rounded-xl" placeholder="Last Name" onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
                <div className="flex gap-4 p-2 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-500 self-center ml-2">Account Type:</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="role" value="buyer" defaultChecked
                            onChange={e => setFormData({ ...formData, role: e.target.value })} />
                        <span className="text-sm">Buyer</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="role" value="seller"
                            onChange={e => setFormData({ ...formData, role: e.target.value })} />
                        <span className="text-sm">Seller</span>
                    </label>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all">
                    Register
                </button>
            </form>
            {status && <p className="mt-4 text-sm text-blue-600 font-medium">{status}</p>}
        </div>
    );
};

export default Register;