import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Chatbot = () => {
    // NO MORE useKeycloak! We only use our states.
    const [messages, setMessages] = useState([{ sender: 'ai', text: 'Hi! I\'m your store assistant. How can I help you?' }]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    const API = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:8001';

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        // --- WE GET THE TOKEN FROM LOCALSTORAGE ---
        const token = localStorage.getItem('token');

        const userMsg = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            // We send a request to our Gemini Chat API (port 8001)
            const response = await axios.post(`${API}/chat`,
                { message: input },
                {
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : ""
                    }
                }
            );

            setMessages(prev => [...prev, {
                sender: 'ai',
                text: response.data.message,
                action: response.data.tool_called
            }]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { sender: 'ai', text: "Error: Message could not be sent. Please make sure you are logged in." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-white shadow-2xl rounded-2xl border border-gray-100 flex flex-col overflow-hidden z-50">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    Gemini AI Assistant
                </div>
            </div>

            <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-none'
                            }`}>
                            {msg.text}
                            {msg.action && (
                                <div className="mt-2 pt-2 border-t border-blue-200 text-[10px] font-mono uppercase tracking-wider opacity-80">
                                    ⚡ Action: {msg.action}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && <div className="text-xs text-gray-400 animate-pulse">Assistant is thinking...</div>}
                <div ref={scrollRef}></div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
                <input
                    className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask the assistant something..."
                />
                <button onClick={sendMessage} className="bg-blue-600 text-white p-2 rounded-xl">
                    🚀
                </button>
            </div>
        </div>
    );
};

export default Chatbot;