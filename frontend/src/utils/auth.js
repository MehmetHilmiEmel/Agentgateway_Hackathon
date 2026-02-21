// src/utils/auth.js
import axios from 'axios';

export const getValidToken = async () => {
    const exp = parseInt(localStorage.getItem('token_exp') || '0');
    const token = localStorage.getItem('token');
    const refresh_token = localStorage.getItem('refresh_token');

    // If the token has more than 30 seconds of life left, return it directly
    if (Date.now() < exp - 30000) {
        return `Bearer ${token}`;
    }

    // Token is about to expire — refresh it
    try {
        const res = await axios.post('http://localhost:8000/refresh', { refresh_token });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('token_exp', Date.now() + (res.data.expires_in * 1000));
        if (res.data.refresh_token) {
            localStorage.setItem('refresh_token', res.data.refresh_token);
        }
        return `Bearer ${res.data.access_token}`;
    } catch {
        localStorage.clear();
        window.location.href = '/';
    }
};