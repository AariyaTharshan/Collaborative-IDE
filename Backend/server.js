const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { promisify } = require('util');
const readdir = promisify(fsSync.readdir);
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://collab-code.vercel.app'
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const rooms = new Map(); // Store room information

// At the top of the file, update the stats variables
let totalUsers = 0;  // This will be cumulative
let activeUsers = 0; // This tracks current active users
let totalSessions = 0;
let totalLinesOfCode = 0;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://collab-code.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

// Create temp directory if it doesn't exist
const tempDir = path.join(process.env.TEMP || '/tmp', 'codocollab');
if (!fsSync.existsSync(tempDir)) {
  fsSync.mkdirSync(tempDir, { recursive: true });
}

// Cleanup function for temp files
const cleanupFile = async (filePath) => {
  try {
    // Check if file exists before attempting to delete
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (exists) {
      await fs.unlink(filePath);
    }
  } catch (err) {
    // Silently ignore errors since they're not critical
    console.debug('Cleanup skipped:', filePath);
  }
};

// Add this function to clean the temp directory
const cleanTempDirectory = async () => {
  try {
    const files = await readdir(tempDir);
    await Promise.all(
      files.map(async file => {
        const filePath = path.join(tempDir, file);
        try {
          const exists = await fs.access(filePath).then(() => true).catch(() => false);
          if (exists) {
            await fs.unlink(filePath);
          }
        } catch (err) {
          console.debug('Failed to delete:', file);
        }
      })
    );
  } catch (err) {
    console.debug('Temp directory cleanup skipped');
  }
};

// Add a function to check and install compilers
const ensureCompilers = async () => {
  try {
    await execAsync('which g++');
  } catch {
    console.log('Installing C++ compiler...');
    await execAsync('apt-get update && apt-get install -y g++');
  }

  try {
    await execAsync('which python3');
  } catch {
    console.log('Installing Python...');
    await execAsync('apt-get update && apt-get install -y python3');
  }

  try {
    await execAsync('which java');
  } catch {
    console.log('Installing Java...');
    await execAsync('apt-get update && apt-get install -y default-jdk');
  }
};

// Handle code compilation
app.post('/compile', async (req, res) => {
  const { code, language, input } = req.body;
  const fileName = `temp_${Date.now()}`;
  let filesToCleanup = [];
  
  try {
    // Create temp directory if it doesn't exist
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, `${fileName}.${language === 'cpp' ? 'cpp' : language === 'python' ? 'py' : 'js'}`);
    filesToCleanup.push(filePath);

    // Write the code to a file
    await fs.writeFile(filePath, code);

    // Write input to file if provided
    let inputPath;
    if (input) {
      inputPath = path.join(tempDir, `${fileName}.input`);
      await fs.writeFile(inputPath, input);
      filesToCleanup.push(inputPath);
    }

    let output;
    switch(language) {
      case 'javascript':
        output = await execAsync(`node "${filePath}"`, { timeout: 5000 });
        break;

      case 'python':
        output = await execAsync(`python3 "${filePath}"`, { timeout: 5000 });
        break;

      case 'cpp': {
        const outputPath = path.join(tempDir, fileName + (process.platform === 'win32' ? '.exe' : ''));
        filesToCleanup.push(outputPath);
        
        // Compile
        await execAsync(`g++ "${filePath}" -o "${outputPath}"`, { timeout: 5000 });
        // Run
        output = await execAsync(outputPath, { timeout: 5000 });
        break;
      }

      case 'java': {
        const className = 'Main';
        const javaCode = code.replace(/public\s+class\s+\w+/, `public class ${className}`);
        const javaFilePath = path.join(tempDir, `${className}.java`);
        filesToCleanup.push(javaFilePath);
        
        await fs.writeFile(javaFilePath, javaCode);
        // Compile
        await execAsync(`javac "${javaFilePath}"`, { timeout: 5000 });
        // Run
        output = await execAsync(`java -cp "${tempDir}" ${className}`, { timeout: 5000 });
        break;
      }

      default:
        throw new Error('Unsupported language');
    }

    // Cleanup files
    await Promise.all(filesToCleanup.map(file => cleanupFile(file)));
    
    res.json({ output: output.stdout });
  } catch (error) {
    console.error('Compilation error:', error);
    
    // Cleanup files even if there's an error
    await Promise.all(filesToCleanup.map(file => cleanupFile(file)));
    
    res.status(500).json({ 
      error: error.toString(),
      details: error.stderr || error.message
    });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  let currentRoom = null;

  // Handle stats requests
  socket.on('get-stats', () => {
    socket.emit('stats-update', {
      activeUsers,
      totalSessions,
      totalLinesOfCode
    });
  });

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

    // Update stats when users join rooms
    activeUsers++;
    totalUsers++;  // Increment total users (cumulative)
    totalSessions++;
    io.emit('stats-update', {
      activeUsers,
      totalUsers,  // Send total users instead
      totalSessions,
      totalLinesOfCode
    });
  });

  socket.on('code-change', ({ roomId, code }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.code = code;
      socket.to(roomId).emit('code-update', code);

      // Update lines of code when code changes
      const lines = code.split('\n').length;
      totalLinesOfCode += lines;
      io.emit('stats-update', {
        activeUsers,
        totalSessions,
        totalLinesOfCode
      });
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

      // Update stats but don't decrease totalUsers
      activeUsers--;
      io.emit('stats-update', {
        activeUsers,
        totalUsers,  // Keep the cumulative count
        totalSessions,
        totalLinesOfCode
      });
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

  socket.on('join-voice', ({ roomId }) => {
    socket.to(roomId).emit('user-joined-voice', { userId: socket.id });
  });

  socket.on('voice-offer', ({ target, sdp, caller }) => {
    io.to(target).emit('voice-offer', { sdp, caller });
  });

  socket.on('voice-answer', ({ target, sdp }) => {
    io.to(target).emit('voice-answer', { sdp, answerer: socket.id });
  });

  socket.on('voice-ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('voice-ice-candidate', { candidate, sender: socket.id });
  });

  socket.on('leave-voice', ({ roomId }) => {
    io.to(roomId).emit('voice-participant-left', {
      userId: socket.id
    });
  });

  socket.on('disconnect', () => {
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

        // Update stats but don't decrease totalUsers
        activeUsers--;
        io.emit('stats-update', {
          activeUsers,
          totalUsers,  // Keep the cumulative count
          totalSessions,
          totalLinesOfCode
        });
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Also clean temp directory when server starts
cleanTempDirectory().catch(console.error);

// Call ensureCompilers when server starts
ensureCompilers().catch(console.error);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 