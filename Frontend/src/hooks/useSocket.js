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
  // Whiteboard-related emitters
  const emitWhiteboardDraw = useCallback((path) => {
    if (socket && roomId) {
      socket.emit('whiteboard-draw', { roomId, path });
    }
  }, [socket, roomId]);

  const emitWhiteboardClear = useCallback(() => {
    if (socket && roomId) {
      socket.emit('whiteboard-clear', { roomId });
    }
  }, [socket, roomId]);

  const getWhiteboardState = useCallback(() => {
    if (socket && roomId) {
      socket.emit('get-whiteboard-state', { roomId });
    }
  }, [socket, roomId]);

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

    // Whiteboard event handlers
    const handleWhiteboardDraw = ({ path }) => {
      if (onWhiteboardDraw) onWhiteboardDraw(path);
    };

    const handleWhiteboardClear = () => {
      if (onWhiteboardClear) onWhiteboardClear();
    };

    const handleWhiteboardState = ({ objects }) => {
      if (onWhiteboardState) onWhiteboardState(objects);
    };

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
    socket.on('whiteboard-draw', handleWhiteboardDraw);
    socket.on('whiteboard-clear', handleWhiteboardClear);
    socket.on('whiteboard-state', handleWhiteboardState);
    socket.on('user-join', handleUserJoin);
    socket.on('user-leave', handleUserLeave);
    socket.on('message', handleMessage);
    socket.on('error', handleError);

    // Cleanup function
    return () => {
      socket.off('whiteboard-draw', handleWhiteboardDraw);
      socket.off('whiteboard-clear', handleWhiteboardClear);
      socket.off('whiteboard-state', handleWhiteboardState);
      socket.off('user-join', handleUserJoin);
      socket.off('user-leave', handleUserLeave);
      socket.off('message', handleMessage);
      socket.off('error', handleError);
    };
  }, [socket, onWhiteboardDraw, onWhiteboardClear, onWhiteboardState, onUserJoin, onUserLeave, onMessage, onError]);

  return {
    // Whiteboard functions
    emitWhiteboardDraw,
    emitWhiteboardClear,
    getWhiteboardState,
    // Room functions
    joinRoom,
    leaveRoom,
    // Message function
    sendMessage,
  };
};

export default useSocket; 