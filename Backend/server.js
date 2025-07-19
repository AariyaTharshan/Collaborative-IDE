require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

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
  pingTimeout: 30000,
  pingInterval: 10000,
  upgradeTimeout: 20000,
  allowUpgrades: true,
  cookie: false,
  maxHttpBufferSize: 1e8
});

const rooms = new Map(); // Store room information
const voiceParticipants = new Map(); // Store voice participants per room
const peerConnections = new Map(); // Store peer connections per room

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://collabcode-ide.vercel.app',
  ],
  methods: ['GET', 'POST'],
  credentials: true,
  optionsSuccessStatus: 204
}));
app.use(express.json());

// Add rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Add compression
app.use(compression());

// Add caching headers middleware
const cacheControl = (req, res, next) => {
  // Cache static assets for 1 day
  if (req.url.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  next();
};
app.use(cacheControl);

const codeTemplates = {
  cpp: {
    basic: `#include <bits/stdc++.h>
using namespace std;

void solve() {
    // Your solution here
}

int main() {
    ios::sync_with_stdio(0);
    cin.tie(0);
    int t = 1;
    // cin >> t;
    while(t--) solve();
    return 0;
}`,
    dataStructures: `#include <bits/stdc++.h>
using namespace std;

// Common DS implementations
struct DSU {
    vector<int> parent, size;
    DSU(int n) : parent(n), size(n, 1) {
        iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) {
        if(parent[x] == x) return x;
        return parent[x] = find(parent[x]);
    }
    void unite(int x, int y) {
        x = find(x), y = find(y);
        if(x != y) {
            if(size[x] < size[y]) swap(x, y);
            parent[y] = x;
            size[x] += size[y];
        }
    }
};`
  },
  c: {
    basic: `#include <stdio.h>

int main() {
    // Your code here
    printf("Hello, World!\\n");
    return 0;
}`,
    algorithms: `// Example: Bubble Sort in C
#include <stdio.h>

void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n-1; i++) {
        for (int j = 0; j < n-i-1; j++) {
            if (arr[j] > arr[j+1]) {
                int temp = arr[j];
                arr[j] = arr[j+1];
                arr[j+1] = temp;
            }
        }
    }
}`,
    linkedList: `// Singly Linked List in C
#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node* next;
};

struct Node* createNode(int data) {
    struct Node* newNode = (struct Node*)malloc(sizeof(struct Node));
    newNode->data = data;
    newNode->next = NULL;
    return newNode;
}

void printList(struct Node* head) {
    while (head != NULL) {
        printf("%d ", head->data);
        head = head->next;
    }
    printf("\n");
}`,
    fileIO: `// File I/O in C
#include <stdio.h>

int main() {
    FILE *fptr;
    fptr = fopen("test.txt", "w");
    if (fptr == NULL) {
        printf("Error opening file!\n");
        return 1;
    }
    fprintf(fptr, "Hello, file!\n");
    fclose(fptr);
    return 0;
}`
  },
  python: {
    basic: `from collections import defaultdict, Counter, deque
from heapq import heappush, heappop
import math

def solve():
    # Your solution here
    pass

if __name__ == "__main__":
    t = 1
    // t = int(input())
    for _ in range(t):
        solve()`,
    algorithms: `# Binary Search Template
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`
  }
};

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
    'javascript': 63,
    'c': 50
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

// other endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// endpoint to get templates
app.get('/templates/:language', (req, res) => {
  const { language } = req.params;
  if (codeTemplates[language]) {
    res.json(codeTemplates[language]);
  } else {
    res.status(404).json({ error: 'Templates not found for this language' });
  }
});

// problem categories and suggestions
const problemSuggestions = {
  beginner: [
    {
      title: "Two Sum",
      difficulty: "Easy",
      category: "Arrays",
      description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
      template: "function twoSum(nums, target) {\n    // Your code here\n}",
      testCases: [
        { input: "[2,7,11,15], 9", output: "[0,1]" },
        { input: "[3,2,4], 6", output: "[1,2]" }
      ]
    }
  ],
  striver: [
    {
      title: "Set Matrix Zeroes",
      difficulty: "Medium",
      category: "Arrays",
      description: "Given an m x n integer matrix, if an element is 0, set its entire row and column to 0.",
      template: "void setZeroes(vector<vector<int>>& matrix) {\n    // Your code here\n}",
      testCases: [
        { input: "[[1,1,1],[1,0,1],[1,1,1]]", output: "[[1,0,1],[0,0,0],[1,0,1]]" }
      ]
    },
    {
      title: "Pascal's Triangle",
      difficulty: "Easy",
      category: "Arrays",
      description: "Given an integer numRows, return the first numRows of Pascal's triangle.",
      template: "vector<vector<int>> generate(int numRows) {\n    // Your code here\n}",
      testCases: [
        { input: "5", output: "[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]" }
      ]
    },
    {
      title: "Next Permutation",
      difficulty: "Medium",
      category: "Arrays",
      description: "Implement next permutation, which rearranges numbers into the lexicographically next greater permutation of numbers.",
      template: "void nextPermutation(vector<int>& nums) {\n    // Your code here\n}",
      testCases: [
        { input: "[1,2,3]", output: "[1,3,2]" }
      ]
    },
    {
      title: "Sort Colors",
      difficulty: "Medium",
      category: "Arrays",
      description: "Given an array with n objects colored red, white, or blue, sort them in-place.",
      template: "void sortColors(vector<int>& nums) {\n    // Your code here\n}",
      testCases: [
        { input: "[2,0,2,1,1,0]", output: "[0,0,1,1,2,2]" }
      ]
    },
    {
      title: "Stock Buy and Sell",
      difficulty: "Easy",
      category: "Arrays",
      description: "Find the maximum profit you can achieve from a single buy and sell of stock.",
      template: "int maxProfit(vector<int>& prices) {\n    // Your code here\n}",
      testCases: [
        { input: "[7,1,5,3,6,4]", output: "5" }
      ]
    }
  ]
};

app.get('/problems/:difficulty', (req, res) => {
  const { difficulty } = req.params;
  const problems = problemSuggestions[difficulty] || [];
  res.json(problems);
});

// complexity analysis endpoint
app.post('/analyze', async (req, res) => {
  const { code, language } = req.body;
  
  // Basic complexity patterns
  const patterns = {
    'O(n)': /for\s*\([^)]*\)/g,
    'O(n²)': /for\s*\([^)]*\)[^{]*{[^}]*for\s*\([^)]*\)/g,
    'O(log n)': /while\s*\([^)]*\/=\s*2\)/g
  };

  let complexity = 'O(1)';
  for (const [big_o, pattern] of Object.entries(patterns)) {
    if (pattern.test(code)) {
      complexity = big_o;
    }
  }

  res.json({ timeComplexity: complexity });
});

const learningResources = {
  algorithms: [
    {
      topic: "Dynamic Programming",
      resources: [
        {
          title: "Introduction to DP",
          type: "video",
          url: "https://example.com/dp-intro"
        },
        {
          title: "Common DP Patterns",
          type: "article",
          url: "https://example.com/dp-patterns"
        }
      ]
    }
  ]
};

app.get('/resources/:topic', (req, res) => {
  const { topic } = req.params;
  const resources = learningResources[topic] || [];
  res.json(resources);
});

// Test case generator
app.post('/generate-tests', (req, res) => {
  const { type, params } = req.body;
  
  const generateArray = (size, max) => {
    return Array.from({ length: size }, () => 
      Math.floor(Math.random() * max)
    );
  };

  const generators = {
    array: (params) => generateArray(params.size, params.maxValue),
    string: (params) => {
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      return Array.from({ length: params.length }, 
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join('');
    },
    tree: (params) => {
      // Generate binary tree test cases
      const nodes = params.nodes;
      return Array.from({ length: nodes }, (_, i) => ({
        value: i,
        left: i * 2 + 1 < nodes ? i * 2 + 1 : null,
        right: i * 2 + 2 < nodes ? i * 2 + 2 : null
      }));
    }
  };

  const testCases = generators[type](params);
  res.json({ testCases });
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
        userCode: new Map(),
        host: socket.id,
        whiteboardObjects: [],
        viewingStates: new Map() // Track what each user is viewing
      });
    }

    const room = rooms.get(roomId);
    room.participants.set(socket.id, username);
    
    // Initialize user's code if not exists
    if (!room.userCode.has(socket.id)) {
      room.userCode.set(socket.id, '// Start coding here...');
    }

    // Set initial viewing state to own code
    room.viewingStates.set(socket.id, socket.id);

    // Send current room state to the joining user
    socket.emit('room-state', {
      language: room.language,
      code: room.userCode.get(socket.id),
      participants: Array.from(room.participants.entries()).map(([id, name]) => ({
        id,
        name,
        isHost: id === room.host
      })),
      isHost: socket.id === room.host,
      viewingUserId: socket.id
    });

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      username,
      participants: Array.from(room.participants.entries()).map(([id, name]) => ({
        id,
        name,
        isHost: id === room.host
      }))
    });
  });

  socket.on('code-change', ({ roomId, code, targetUserId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const isHost = room.host === socket.id;
    const username = room.participants.get(socket.id);
    if (!username) return;
    // Only allow code change if host or editing own IDE
    const editUserId = isHost ? (targetUserId || socket.id) : socket.id;
    if (isHost || room.viewingStates.get(socket.id) === socket.id) {
      // Store the code for the correct user
      room.userCode.set(editUserId, code);
      // Get all users who are currently viewing this user's code
      const viewers = Array.from(room.viewingStates.entries())
        .filter(([_, viewingId]) => viewingId === editUserId)
        .map(([userId]) => userId);
      // Broadcast to all viewers (including self for instant sync)
      viewers.forEach(viewerId => {
        io.to(viewerId).emit('code-update', {
          userId: editUserId,
          code: code
        });
      });
    }
  });

  socket.on('view-user-code', ({ roomId, targetUserId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    // Allow all users to view any IDE
    room.viewingStates.set(socket.id, targetUserId);
    const targetCode = room.userCode.get(targetUserId) || '// Start coding here...';
    socket.emit('code-update', {
      userId: targetUserId,
      code: targetCode
    });
    // Notify others about the view change
    socket.to(roomId).emit('view-state-changed', {
      userId: socket.id,
      viewingUserId: targetUserId
    });
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
      room.viewingStates.delete(socket.id);
      socket.leave(roomId);
      
      io.to(roomId).emit('user-left', {
        userId: socket.id,
        username,
        participants: Array.from(room.participants.entries()).map(([id, name]) => ({
          id,
          name,
          isHost: id === room.host
        }))
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

  socket.on('user-joined', ({ participants }) => {
    // Always send consistent participant structure
    io.emit('user-joined', {
      participants: Array.from(room.participants.entries()).map(([id, name]) => ({
        id,
        name,
        isHost: id === room.host
      }))
    });
  });

  socket.on('user-left', ({ participants }) => {
    io.emit('user-left', {
      participants: Array.from(room.participants.entries()).map(([id, name]) => ({
        id,
        name,
        isHost: id === room.host
      }))
    });
  });
});

io.on('connect_error', (err) => {
  console.log('Connection error:', err);
});

io.engine.on('connection_error', (err) => {
  console.log('Connection error:', err);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Websocket server is ready');
}); 
