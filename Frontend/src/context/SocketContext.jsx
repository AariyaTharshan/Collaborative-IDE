import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('Attempting to connect to:', import.meta.env.VITE_BACKEND_URL);
    
    let newSocket;
    try {
      newSocket = io(import.meta.env.VITE_BACKEND_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling'],
        secure: true,
        rejectUnauthorized: false
      });

      newSocket.on('connect', () => {
        console.log('Socket connected successfully to:', import.meta.env.VITE_BACKEND_URL);
        setIsConnecting(false);
        setError(null);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Connection error details:', {
          message: err.message,
          description: err.description,
          type: err.type,
          url: import.meta.env.VITE_BACKEND_URL
        });
        setError(`Connection failed: ${err.message}`);
        setIsConnecting(false);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnecting(true);
      });

      setSocket(newSocket);
    } catch (err) {
      console.error('Socket initialization error:', err);
      setError(`Failed to initialize connection: ${err.message}`);
      setIsConnecting(false);
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-4 max-w-md">
          <div className="text-red-500 mb-4">⚠️ Connection Error</div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#FFA116] text-white rounded-lg hover:bg-[#FF9100]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFA116] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Connecting to server...</p>
        </div>
      </div>
    );
  }

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const socket = useContext(SocketContext);
  if (!socket) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return socket;
}; 