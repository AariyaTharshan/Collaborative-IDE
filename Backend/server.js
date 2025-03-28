require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://collabcode-ide.vercel.app',
    ],
    methods: ["GET", "POST"],
    credentials: true,
    transports: ['websocket', 'polling']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
  cookie: false
});

const rooms = new Map(); // Store room information
const voiceParticipants = new Map(); // Store voice participants per room
const peerConnections = new Map(); // Store peer connections per room

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://collabcode-ide.vercel.app',
    'https://collaborative-ide-k4rx.onrender.com'
  ],
  methods: ['GET', 'POST'],
  credentials: true,
  optionsSuccessStatus: 204
}));
app.use(express.json());

// Handle code compilation
app.post('/compile', async (req, res) => {
  const { code, language, input } = req.body;
  
  if (!process.env.RAPID_API_KEY) {
    return res.status(500).json({ 
      error: 'Server configuration error: API key not found'
    });
  }

  const languageMap = {
    'cpp': 54,
    'java': 62,
    'python': 71,
    'javascript': 63
  };

  try {
    const response = await axios.post('https://judge0-ce.p.rapidapi.com/submissions', {
      source_code: code,
      stdin: input,
      language_id: languageMap[language]
    }, {
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        'X-RapidAPI-Key': process.env.RAPID_API_KEY
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const token = response.data.token;
    let result;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        const resultResponse = await axios.get(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
          headers: {
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
            'X-RapidAPI-Key': process.env.RAPID_API_KEY
          }
        });

        if (resultResponse.data.status.id <= 2) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        result = resultResponse.data;
        break;
      } catch (error) {
        console.error('Error fetching result:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!result) {
      throw new Error('Compilation timed out');
    }

    if (result.status.id === 3) {
      res.json({ output: result.stdout || 'Program completed successfully' });
    } else if (result.status.id === 6) {
      res.status(400).json({ error: result.compile_output });
    } else {
      res.status(400).json({ 
        error: result.stderr || result.status.description || 'Execution error'
      });
    }

  } catch (error) {
    console.error('Compilation error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Compilation failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// Add this near your other endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  let currentRoom = null;

  socket.on('join-room', ({ roomId, language, username }) => {
    // Store current room
    currentRoom = roomId;
    // Leave previous room if any
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    // Check if room exists when joining
    if (!rooms.has(roomId) && !language) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Join new room
    socket.join(roomId);

    // Initialize room if it doesn't exist (creating new room)
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        language,
        participants: new Map(),
        code: '// Start coding here...',
        host: socket.id
      });
    }

    const room = rooms.get(roomId);
    room.participants.set(socket.id, username);

    // Send current room state to the joining user
    socket.emit('room-state', {
      language: room.language,
      code: room.code,
      participants: Array.from(room.participants.values()),
      isHost: socket.id === room.host
    });

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      username,
      participants: Array.from(room.participants.values())
    });
  });

  socket.on('code-change', ({ roomId, code }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.code = code;
      socket.to(roomId).emit('code-update', code);
    }
  });

  socket.on('chat-message', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    const username = room?.participants.get(socket.id);
    socket.to(roomId).emit('receive-message', {
      message,
      sender: socket.id,
      username
    });
  });

  socket.on('call-user', (data) => {
    const room = rooms.get(data.roomId);
    if (room) {
      socket.to(data.userToCall).emit('incoming-call', {
        signal: data.signalData,
        from: socket.id,
        username: room.participants.get(socket.id)
      });
    }
  });

  socket.on('answer-call', (data) => {
    socket.to(data.to).emit('call-accepted', data.signal);
  });

  socket.on('change-language', ({ roomId, newLanguage }) => {
    const room = rooms.get(roomId);
    if (room && room.host === socket.id) {
      room.language = newLanguage;
      io.to(roomId).emit('language-changed', { language: newLanguage });
    }
  });

  socket.on('leave-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.participants.has(socket.id)) {
      const username = room.participants.get(socket.id);
      room.participants.delete(socket.id);
      socket.leave(roomId);
      
      io.to(roomId).emit('user-left', {
        userId: socket.id,
        username,
        participants: Array.from(room.participants.values())
      });

      // Clean up empty rooms
      if (room.participants.size === 0) {
        rooms.delete(roomId);
      }
    }
  });

  socket.on('end-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.host === socket.id) {
      // Notify all participants that the room is ending
      io.to(roomId).emit('room-ended', {
        message: 'The host has ended the room'
      });
      
      // Remove all participants and clean up
      room.participants.forEach((_, participantId) => {
        const participantSocket = io.sockets.sockets.get(participantId);
        if (participantSocket) {
          participantSocket.leave(roomId);
        }
      });
      
      rooms.delete(roomId);
    }
  });

  socket.on('join-voice', ({ roomId, userId, username }) => {
    if (!voiceParticipants.has(roomId)) {
      voiceParticipants.set(roomId, new Map());
    }
    
    const roomVoiceParticipants = voiceParticipants.get(roomId);
    roomVoiceParticipants.set(socket.id, username);

    // Send current voice participants to the joining user
    socket.emit('voice-participants', {
      participants: Array.from(roomVoiceParticipants.entries())
    });

    // Notify others in the room about the new participant
    socket.to(roomId).emit('voice-participant-joined', {
      userId: socket.id,
      username
    });

    // Trigger connection establishment with all existing participants
    roomVoiceParticipants.forEach((participantUsername, participantId) => {
      if (participantId !== socket.id) {
        // Notify existing participant to initiate a connection
        io.to(participantId).emit('initiate-voice-connection', {
          targetId: socket.id,
          username: username
        });
      }
    });
  });

  socket.on('voice-offer', ({ target, sdp, caller }) => {
    io.to(target).emit('voice-offer', {
      sdp,
      caller,
      callerUsername: voiceParticipants.get(currentRoom)?.get(caller)
    });
  });

  socket.on('voice-answer', ({ target, sdp }) => {
    io.to(target).emit('voice-answer', {
      sdp,
      answerer: socket.id,
      answererUsername: voiceParticipants.get(currentRoom)?.get(socket.id)
    });
  });

  socket.on('voice-ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('voice-ice-candidate', {
      candidate,
      sender: socket.id
    });
  });

  socket.on('leave-voice', ({ roomId }) => {
    if (voiceParticipants.has(roomId)) {
      const roomVoiceParticipants = voiceParticipants.get(roomId);
      roomVoiceParticipants.delete(socket.id);

      // Notify others in the room to clean up their peer connections
      io.to(roomId).emit('voice-participant-left', {
        userId: socket.id,
        remainingParticipants: Array.from(roomVoiceParticipants.entries())
      });

      // Clean up empty voice rooms
      if (roomVoiceParticipants.size === 0) {
        voiceParticipants.delete(roomId);
      }
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason);
    // Clean up if user was in a room
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      if (room.participants.has(socket.id)) {
        const username = room.participants.get(socket.id);
        room.participants.delete(socket.id);
        
        // Notify others in the room
        io.to(currentRoom).emit('user-left', {
          userId: socket.id,
          username,
          participants: Array.from(room.participants.values())
        });
        
        // Clean up empty rooms
        if (room.participants.size === 0) {
          rooms.delete(currentRoom);
        }
      }
    }
    
    // Clean up voice participants and notify others
    voiceParticipants.forEach((participants, roomId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        io.to(roomId).emit('voice-participant-left', {
          userId: socket.id,
          remainingParticipants: Array.from(participants.entries())
        });
        
        if (participants.size === 0) {
          voiceParticipants.delete(roomId);
        }
      }
    });
  });

  // Add ping/pong for connection health check
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

io.on('connect_error', (err) => {
  console.log('Connection error:', err);
});

io.engine.on('connection_error', (err) => {
  console.log('Connection error:', err);
});

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log('Websocket server is ready');
}); 