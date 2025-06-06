import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const RoomEntry = ({ onJoinRoom }) => {
  const socket = useSocket();
  const [mode, setMode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [showThankYou, setShowThankYou] = useState(false);

  useEffect(() => {
    // Setup periodic health check
    const healthCheck = setInterval(() => {
      if (socket) {
        socket.emit('ping');
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(healthCheck);
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    
    if (mode === 'create') {
      const newRoomId = Math.random().toString(36).substring(2, 9);
      onJoinRoom(newRoomId, language, username);
    } else {
      onJoinRoom(roomId, null, username);
    }
  };

  const handleDisconnect = () => {
    if (socket) {
      // Properly close the connection
      socket.disconnect();
      setShowThankYou(true);
      
      setTimeout(() => {
        setTimeout(() => {
          window.close();
          window.location.href = 'about:blank';
        }, 2000);
      }, 100);
    }
  };

  if (showThankYou) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1A1A1A]">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#FFA116] to-[#FF6B6B] text-transparent bg-clip-text">
            Thanks for using CollabCode!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Hope to see you code with us again soon.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 animate-pulse">
            Window will close in 2 seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1A1A1A] relative">
      <button
        onClick={handleDisconnect}
        className="absolute top-4 right-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 z-20"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
          />
        </svg>
        Disconnect
      </button>

      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `
            radial-gradient(#FFA116 1px, transparent 1px), 
            radial-gradient(#FFA116 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          backgroundPosition: '0 0, 25px 25px',
        }}
      />

      <div className="w-11/12 max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#FFA116] to-[#FF6B6B] text-transparent bg-clip-text">
            CollabCode IDE
          </h1>
          <p className="text-[#FFA116] text-lg font-medium">
            Real-time Collaborative Coding
          </p>
        </div>

        <div className="bg-white dark:bg-[#282828] p-8 rounded-lg shadow-2xl border border-[#444]/10 dark:border-[#444]/20">
          <div className="flex gap-3 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-lg mb-8">
          <button
              className={`flex-1 py-3 rounded-md text-base font-medium transition-all duration-200 ${
              mode === 'create' 
                  ? 'bg-[#FFA116] text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:text-[#FFA116] dark:hover:text-[#FFA116]'
            }`}
            onClick={() => setMode('create')}
          >
            Create Room
          </button>
          <button
              className={`flex-1 py-3 rounded-md text-base font-medium transition-all duration-200 ${
              mode === 'join' 
                  ? 'bg-[#FFA116] text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:text-[#FFA116] dark:hover:text-[#FFA116]'
            }`}
            onClick={() => setMode('join')}
          >
            Join Room
          </button>
        </div>

        {mode && (
            <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFA116] focus:border-transparent transition-all"
                required
                placeholder="Enter your username"
              />
            </div>

            {mode === 'join' ? (
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFA116] focus:border-transparent transition-all"
                  required
                  placeholder="Enter room ID"
                />
              </div>
            ) : (
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Programming Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FFA116] focus:border-transparent transition-all"
                  required
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                  <option value="c">C</option>
                </select>
              </div>
            )}

            <button
              type="submit"
                className="w-full py-3 bg-[#FFA116] hover:bg-[#FF9100] text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFA116]"
            >
              {mode === 'create' ? 'Create Room' : 'Join Room'}
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};

export default RoomEntry; 