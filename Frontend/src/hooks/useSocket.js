import React, { useCallback, useEffect } from 'react';

const useSocket = (socket, roomId, {
  onWhiteboardDraw,
  onWhiteboardClear,
  onWhiteboardState,
  onUserJoin,
  onUserLeave,
  onMessage,
  onError
} = {}) => {
  // Room-related emitters
  const joinRoom = useCallback(() => {
    if (socket && roomId) {
      socket.emit('join-room', { roomId });
    }
  }, [socket, roomId]);

  const leaveRoom = useCallback(() => {
    if (socket && roomId) {
      socket.emit('leave-room', { roomId });
    }
  }, [socket, roomId]);

  // Message emitter
  const sendMessage = useCallback((message) => {
    if (socket && roomId) {
      socket.emit('message', { roomId, message });
    }
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket) return;

    // Room event handlers
    const handleUserJoin = ({ userId, username }) => {
      if (onUserJoin) onUserJoin(userId, username);
    };

    const handleUserLeave = ({ userId, username }) => {
      if (onUserLeave) onUserLeave(userId, username);
    };

    // Message handler
    const handleMessage = ({ userId, username, message }) => {
      if (onMessage) onMessage(userId, username, message);
    };

    // Error handler
    const handleError = (error) => {
      if (onError) onError(error);
    };

    // Register event listeners
    socket.on('user-join', handleUserJoin);
    socket.on('user-leave', handleUserLeave);
    socket.on('message', handleMessage);
    socket.on('error', handleError);

    // Cleanup function
    return () => {
      socket.off('user-join', handleUserJoin);
      socket.off('user-leave', handleUserLeave);
      socket.off('message', handleMessage);
      socket.off('error', handleError);
    };
  }, [socket, onUserJoin, onUserLeave, onMessage, onError]);

  return {
    // Room functions
    joinRoom,
    leaveRoom,
    // Message function
    sendMessage,
  };
};

export default useSocket; 