// src/pages/Home.jsx
import React from 'react';
import Chatbot from '../components/Chatbot';

const Home = () => {
    return (
        <div className="p-10 max-w-6xl mx-auto">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-3xl p-12 text-white mb-10 shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-5xl font-black mb-4 tracking-tighter">Welcome to the Market of the Future!</h1>
                    <p className="text-blue-100 text-lg max-w-xl">
                        This platform is powered by AgentGateway and Gemini.
                        Log in now and start shopping with your AI assistant.
                    </p>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            </div>

            <h2 className="text-3xl font-bold mb-8 text-gray-800">Showcase</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl transition-all group cursor-pointer">
                        <div className="h-48 bg-gray-100 rounded-2xl mb-4 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform">
                            📦
                        </div>
                        <h3 className="font-bold text-xl text-gray-900">Premium Product #{i}</h3>
                        <p className="text-gray-500 text-sm mt-1">Special production technological equipment.</p>
                        <div className="mt-4 flex justify-between items-center">
                            <span className="text-blue-600 font-black text-xl">$45,000</span>
                            <button className="bg-gray-100 p-2 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                Details
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Our AI Assistant is always ready here */}
            <Chatbot />
        </div>
    );
};

export default Home;