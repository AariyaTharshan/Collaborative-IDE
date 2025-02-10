import React, { useState } from 'react';

const RoomEntry = ({ onJoinRoom }) => {
  const [mode, setMode] = useState(''); // 'create' or 'join'
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [language, setLanguage] = useState('javascript');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    
    if (mode === 'create') {
      // Generate a random room ID if creating a new room
      const newRoomId = Math.random().toString(36).substring(2, 9);
      onJoinRoom(newRoomId, language, username);
    } else {
      onJoinRoom(roomId, null, username);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-11/12 max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">Join Coding Room</h1>
        
        <div className="flex gap-4 mb-6">
          <button
            className={`flex-1 py-2 rounded transition-colors ${
              mode === 'create' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            onClick={() => setMode('create')}
          >
            Create Room
          </button>
          <button
            className={`flex-1 py-2 rounded transition-colors ${
              mode === 'join' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            onClick={() => setMode('join')}
          >
            Join Room
          </button>
        </div>

        {mode && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
                placeholder="Enter your username"
              />
            </div>

            {mode === 'join' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Room ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  placeholder="Enter room ID"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Programming Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              {mode === 'create' ? 'Create Room' : 'Join Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RoomEntry; 