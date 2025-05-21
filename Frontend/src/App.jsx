import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import SimplePeer from 'simple-peer';
import axios from 'axios';
import RoomEntry from './components/RoomEntry';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './context/ThemeContext';
import HelpPage from './components/HelpPage';
import { SocketProvider, useSocket } from './context/SocketContext';
import Problems from './components/Problems';

const AppContent = () => {
  const socket = useSocket();
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('// Start coding here...');
  const [output, setOutput] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isCallActive, setIsCallActive] = useState(false);
  const [stream, setStream] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [programInput, setProgramInput] = useState('');
  const [voiceParticipants, setVoiceParticipants] = useState(new Map());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [peerConnections, setPeerConnections] = useState(new Map());
  const [viewingUserId, setViewingUserId] = useState(null);
  const localStreamRef = useRef(null);
  
  const peerRef = useRef(null);
  const { isDark } = useTheme();
  const [complexity, setComplexity] = useState({ time: 'O(1)', space: 'O(1)' });
  const [isProblemsPanelOpen, setIsProblemsPanelOpen] = useState(false);
  const [isCodeLoading, setIsCodeLoading] = useState(false);

  useEffect(() => {
    if (!isInRoom) return;

    socket.emit('join-room', { roomId, language, username });

    socket.on('room-state', ({ language: roomLanguage, code: roomCode, participants: roomParticipants, isHost: isRoomHost, viewingUserId: initialViewingUserId }) => {
      setLanguage(roomLanguage);
      setCode(roomCode);
      setParticipants(roomParticipants || []);
      setIsHost(isRoomHost);
      setViewingUserId(initialViewingUserId);
    });

    socket.on('error', ({ message }) => {
      alert(message);
      setIsInRoom(false);
    });

    socket.on('user-joined', ({ participants: updatedParticipants }) => {
      setParticipants(updatedParticipants || []);
    });

    socket.on('user-left', ({ participants: newParticipants }) => {
      setParticipants(newParticipants || []);
    });

    socket.on('code-update', ({ userId, code: newCode }) => {
      setCode(newCode);
      setIsCodeLoading(false);
    });

    socket.on('receive-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    socket.on('incoming-call', ({ from, signal }) => {
      handleIncomingCall(from, signal);
    });

    socket.on('language-changed', ({ language: newLanguage }) => {
      setLanguage(newLanguage);
    });

    socket.on('room-ended', ({ message }) => {
      alert(message);
      handleLeaveRoom();
    });

    socket.on('voice-participants', ({ participants }) => {
      setVoiceParticipants(new Map(participants));
    });

    socket.on('voice-participant-joined', ({ userId, username }) => {
      console.log('Voice participant joined:', userId, username);
      setVoiceParticipants(prev => {
        const updated = new Map(prev);
        updated.set(userId, username);
        return updated;
      });
    });

    socket.on('voice-participant-left', ({ userId }) => {
      console.log('Voice participant left:', userId);
      setVoiceParticipants(prev => {
        const updated = new Map(prev);
        updated.delete(userId);
        return updated;
      });
    });

    socket.on('call-accepted', (signal) => {
      if (peerRef.current) {
        peerRef.current.signal(signal);
      }
    });

    socket.on('view-state-changed', ({ userId, viewingUserId: newViewingUserId }) => {
      // Update the UI to reflect who is viewing what
      setParticipants(prev => prev.map(p => ({
        ...p,
        isViewing: p.id === newViewingUserId
      })));
    });

    return () => {
      socket.off('room-state');
      socket.off('error');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('code-update');
      socket.off('receive-message');
      socket.off('incoming-call');
      socket.off('language-changed');
      socket.off('room-ended');
      socket.off('voice-participants');
      socket.off('voice-participant-joined');
      socket.off('voice-participant-left');
      socket.off('call-accepted');
      socket.off('view-state-changed');
    };
  }, [isInRoom, roomId, socket]);

  const handleJoinRoom = (newRoomId, selectedLanguage, userUsername) => {
    setRoomId(newRoomId);
    if (selectedLanguage) setLanguage(selectedLanguage);
    setUsername(userUsername);
    setIsInRoom(true);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    const targetUserId = isHost ? viewingUserId : socket.id;
    socket?.emit('code-change', { roomId, code: newCode, targetUserId });
    analyzeComplexity(newCode);
  };

  const analyzeComplexity = (code) => {

    const getIndentationLevel = (line) => {
      const match = line.match(/^[ \t]*/);
      return match ? match[0].length : 0;
    };


    const lines = code.split('\n');
    
    let maxLoopNesting = 0;
    let currentNesting = 0;
    let hasRecursion = false;
    let hasDataStructures = false;
    let hasSorting = false;
    let hasExponentialOps = false;


    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      const currentIndentation = getIndentationLevel(lines[i]);
      
      if (line.match(/\bfor\b|\bwhile\b/)) {
   
        if (i > 0 && currentIndentation <= getIndentationLevel(lines[i-1])) {
          currentNesting = 1;
        } else {
          currentNesting++;
        }
        maxLoopNesting = Math.max(maxLoopNesting, currentNesting);
      }

      // Check for recursion
      if (line.match(/\bdef\b.*\(.*\).*:/) && code.includes(line.match(/\bdef\b\s+(\w+)/)[1])) {
        hasRecursion = true;
      }

      // Check for data structures
      if (line.match(/list|dict|set|array|vector|map|queue|stack|heap|tree/)) {
        hasDataStructures = true;
      }

      // Check for sorting
      if (line.match(/\.sort|sorted|sort\(|mergesort|quicksort|heapsort/)) {
        hasSorting = true;
      }

      // Check for exponential operations
      if (line.match(/combinations|permutations|power\s*set|factorial/)) {
        hasExponentialOps = true;
      }
    }

    // Determine time complexity
    let timeComplexity = 'O(1)';
    if (hasExponentialOps) {
      timeComplexity = 'O(2ⁿ)';
    } else if (maxLoopNesting >= 2) {
      timeComplexity = 'O(n²)';
    } else if (hasSorting) {
      timeComplexity = 'O(n log n)';
    } else if (maxLoopNesting === 1) {
      timeComplexity = 'O(n)';
    } else if (hasRecursion || line.match(/binary.*search|log/)) {
      timeComplexity = 'O(log n)';
    }

    // Determine space complexity
    let spaceComplexity = 'O(1)';
    if (maxLoopNesting >= 2 && hasDataStructures) {
      spaceComplexity = 'O(n²)';
    } else if (hasDataStructures || maxLoopNesting >= 1) {
      spaceComplexity = 'O(n)';
    } else if (hasRecursion) {
      spaceComplexity = 'O(log n)';
    }

    setComplexity({ time: timeComplexity, space: spaceComplexity });
  };

  const handleCompile = async () => {
    try {
      setOutput('Compiling...');
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/compile`, {
        code,
        language,
        input: programInput
      }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.error) {
        setOutput(`Error: ${response.data.error}`);
      } else {
        setOutput(response.data.output || 'No output');
      }
    } catch (error) {
      console.error('Compilation error:', error);
      if (error.response) {
        setOutput(`Server Error: ${error.response.data.error || error.response.data}`);
      } else if (error.request) {
        setOutput('Network Error: Could not reach the compilation server. Please try again.');
      } else {
        setOutput('Error: ' + error.message);
      }
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      socket?.emit('chat-message', {
        roomId,
        message: newMessage
      });
      setMessages(prev => [...prev, { message: newMessage, sender: 'me' }]);
      setNewMessage('');
    }
  };

  const handleLeaveRoom = () => {
    if (isCallActive) {
      peerRef.current?.destroy();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    socket?.emit('leave-room', { roomId });
    setIsInRoom(false);
    setMessages([]);
    setCode('// Start coding here...');
    setOutput('');
    setIsCallActive(false);
    peerRef.current = null;
  };

  const handleEndRoom = () => {
    if (isHost) {
      socket?.emit('end-room', { roomId });
      handleLeaveRoom();
    }
  };

  const startCall = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false
      });

      setStream(mediaStream);
      setIsCallActive(true);

      //voice participants and notify others
      socket?.emit('join-voice', { 
        roomId,
        userId: socket.id,
        username 
      });

      // Listen for new peers joining
      socket?.on('user-joined-voice', ({ userId, username }) => {
        console.log('User joined voice:', userId, username);
        setVoiceParticipants(prev => new Map(prev).set(userId, username));
        
        if (userId !== socket.id) {
          const peerConnection = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });

          // Add local stream
          mediaStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, mediaStream);
          });

          // offer
          peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
              socket?.emit('voice-offer', {
                target: userId,
                caller: socket.id,
                sdp: peerConnection.localDescription
              });
            });

          setPeerConnections(prev => new Map(prev).set(userId, peerConnection));
        }
      });

      // Handle voice offers
      socket?.on('voice-offer', async ({ sdp, caller }) => {
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        //local stream
        mediaStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, mediaStream);
        });

        // remote description
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket?.emit('voice-answer', {
          target: caller,
          sdp: peerConnection.localDescription
        });

        setPeerConnections(prev => new Map(prev).set(caller, peerConnection));
      });

      // Handle voice answers
      socket?.on('voice-answer', async ({ sdp, answerer }) => {
        const peerConnection = peerConnections.get(answerer);
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      });

      // Handle participant leaving voice
      socket?.on('voice-participant-left', ({ userId }) => {
        console.log('User left voice:', userId);
        setVoiceParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        
        const peerConnection = peerConnections.get(userId);
        if (peerConnection) {
          peerConnection.close();
          setPeerConnections(prev => {
            const newMap = new Map(prev);
            newMap.delete(userId);
            return newMap;
          });
        }
      });

    } catch (err) {
      console.error('Failed to start call:', err);
      alert('Failed to access microphone');
    }
  };

  const handleIncomingCall = async (from, incomingSignal) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      setStream(mediaStream);

      const newPeer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
        config: {
          iceServers: [
            { 
              urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
              ]
            },
            {
              urls: 'turn:numb.viagenie.ca',
              username: 'webrtc@live.com',
              credential: 'muazkh'
            }
          ]
        }
      });

      newPeer.on('signal', (data) => {
        socket?.emit('answer-call', { signal: data, to: from });
      });

      newPeer.on('stream', (remoteStream) => {
          const audio = new Audio();
          audio.srcObject = remoteStream;
        audio.play().catch(err => {
          console.error('Audio play error:', err);
          // Try playing on user interaction
          document.addEventListener('click', () => {
            audio.play().catch(console.error);
          }, { once: true });
        });
      });

      newPeer.signal(incomingSignal);
      peerRef.current = newPeer;
      setIsCallActive(true);
      socket?.emit('join-voice', { roomId });

    } catch (err) {
      console.error('Failed to handle incoming call:', err);
      alert('Failed to access microphone. Please ensure microphone permissions are granted.');
    }
  };

  const handleLeaveCall = () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      peerConnections.forEach(connection => {
        connection.close();
      });

      setPeerConnections(new Map());
      setStream(null);
      setIsCallActive(false);

      // Notify server about leaving voice
      socket?.emit('leave-voice', { 
        roomId,
        userId: socket.id 
      });

    } catch (error) {
      console.error('Error leaving call:', error);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    if (isHost) {
      socket?.emit('change-language', { roomId, newLanguage });
    }
  };

  const handleViewUserCode = (userId) => {
    setIsCodeLoading(true);
    setViewingUserId(userId);
    socket.emit('view-user-code', { roomId, targetUserId: userId });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1A] text-gray-900 dark:text-white">
      {!isInRoom ? (
        <RoomEntry onJoinRoom={handleJoinRoom} />
      ) : (
        <div className="h-screen flex flex-col">
          {/* Header */}
          <div className="bg-white dark:bg-[#282828] border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-[#FFA116]">CollabCode IDE</h1>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Room ID: <span className="font-mono text-[#FFA116]">{roomId}</span>
                </div>
                <button
                  onClick={handleLeaveRoom}
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                  Leave Room
                </button>
                {isHost && (
                  <button
                    onClick={handleEndRoom}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    End Room
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row h-full relative">
            {/* Left Panel - Sidebar */}
            <div className="w-full lg:w-[22%] h-[30vh] lg:h-full bg-white dark:bg-[#282828] border-b lg:border-r border-gray-200 dark:border-gray-700 flex flex-col">
              {/* Room Info */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Language: <span className="text-[#FFA116]">{language}</span>
                </div>
              </div>

              {/* Participants Lists */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                    Room Participants ({participants.length})
                  </h3>
                  <div className="max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    <ul className="space-y-1">
                      {participants.map((participant) => (
                        <li key={participant.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {participant.name} {participant.isHost ? '(Host)' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                    Voice Participants ({voiceParticipants.size})
                  </h3>
                  <div className="max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    <ul className="space-y-1">
                      {Array.from(voiceParticipants.entries()).map(([userId, name]) => (
                        <li key={userId} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="w-2 h-2 rounded-full bg-[#FFA116]"></span>
                          {name}
                          {userId === socket.id && " (You)"}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Voice Controls */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={isCallActive ? handleLeaveCall : startCall}
                  className={`w-full px-4 py-2.5 ${
                    isCallActive 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-[#FFA116] hover:bg-[#FF9100]'
                  } text-white rounded-md transition-colors flex items-center justify-center gap-2`}
                >
                  {isCallActive ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Leave Voice
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      Join Voice
                    </>
                  )}
                </button>
              </div>

              {/* Chat Section */}
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Chat</h3>
                <div className="flex-1 overflow-y-auto mb-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.sender === 'me' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div className={`max-w-[80%] break-words ${
                        msg.sender === 'me' 
                          ? 'bg-[#FFA116] text-white' 
                          : 'bg-gray-700 dark:bg-gray-600 text-white'
                      } rounded-lg px-3 py-2`}>
                        {msg.sender !== 'me' && (
                          <div className="text-xs text-[#FFA116] font-medium mb-1">
                            {msg.username}
                          </div>
                        )}
                        <div className="text-white">{msg.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Chat Input */}
                <form onSubmit={sendMessage} className="flex gap-2 mt-auto">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 text-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
                    placeholder="Type a message..."
                  />
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-[#FFA116] text-white rounded-md hover:bg-[#FF9100]"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>

            {/* Right Panel - Editor/Whiteboard */}
            <div className="w-full lg:w-[78%] h-[70vh] lg:h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                      Code Editor
                    </h2>
                    {isHost && (
                      <select 
                        value={language}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FFA116]"
                      >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="cpp">C++</option>
                        <option value="java">Java</option>
                        <option value="c">C</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Time:</span>
                        <span className="font-mono text-sm text-[#FFA116]">{complexity.time}</span>
                      </div>
                      <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Space:</span>
                        <span className="font-mono text-sm text-[#FFA116]">{complexity.space}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editor Section */}
              <div className="flex-1 relative">
                <div className="absolute top-0 left-0 right-0 bg-gray-100 dark:bg-gray-800 p-2 flex items-center justify-between z-10" style={{ minHeight: 0 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Viewing:
                    </span>
                    <select
                      value={viewingUserId}
                      onChange={e => handleViewUserCode(e.target.value)}
                      className="px-2 py-1 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFA116] text-sm"
                    >
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.name}
                          {participant.isHost ? ' (Host)' : ''}
                          {participant.id === socket.id ? ' (You)' : ''}
                        </option>
                      ))}
                    </select>
                    {viewingUserId === socket.id && (
                      <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                        Editable
                      </span>
                    )}
                    {!isHost && viewingUserId !== socket.id && (
                      <span className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded-full">
                        View Only
                      </span>
                    )}
                  </div>
                  {isHost && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Host Mode:
                      </span>
                      <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                        Full Access
                      </span>
                    </div>
                  )}
                </div>
                <div className="pt-8 h-full">
                  {isCodeLoading ? (
                    <div className="flex items-center justify-center h-full text-lg text-gray-500 dark:text-gray-400">Loading code...</div>
                  ) : (
                    <Editor
                      height="100%"
                      language={language}
                      value={code}
                      onChange={handleCodeChange}
                      theme={isDark ? "vs-dark" : "light"}
                      options={{
                        readOnly: !(isHost || viewingUserId === socket.id),
                        fontSize: 14,
                        minimap: { enabled: false },
                        automaticLayout: true,
                        padding: { top: 16, bottom: 16 },
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: {
                          other: true,
                          comments: true,
                          strings: true
                        },
                        snippetSuggestions: "top",
                        wordBasedSuggestions: true,
                        parameterHints: {
                          enabled: true
                        },
                        suggest: {
                          showKeywords: true,
                          showSnippets: true,
                          showClasses: true,
                          showFunctions: true,
                          showVariables: true,
                          showWords: true,
                          showMethods: true,
                          preview: true,
                          showIcons: true,
                          showStatusBar: true,
                          showInlineDetails: true
                        },
                        tabCompletion: "on",
                        acceptSuggestionOnEnter: "on",
                        acceptSuggestionOnCommitCharacter: true,
                        suggestSelection: "first",
                        wordSeparators: "`~!@#$%^&*()=+[{]}\\|;:'\",.<>/?",
                        autoClosingBrackets: "always",
                        autoClosingQuotes: "always",
                        autoSurround: "languageDefined",
                        formatOnPaste: true,
                        formatOnType: true,
                        folding: true,
                        foldingStrategy: "auto",
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        cursorSmoothCaretAnimation: "on",
                        cursorBlinking: "smooth",
                        renderWhitespace: "selection",
                        renderLineHighlight: "all",
                        renderValidationDecorations: "on",
                        scrollbar: {
                          vertical: "visible",
                          horizontal: "visible",
                          useShadows: false,
                          verticalScrollbarSize: 10,
                          horizontalScrollbarSize: 10
                        }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Output Section */}
              <div className="h-[30%] bg-white dark:bg-[#282828] rounded-lg shadow-sm p-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Output</h2>
                <div className="flex flex-col h-[calc(100%-2.5rem)] gap-3">
                  <div className="flex-1">
                    <textarea
                      value={programInput}
                      onChange={(e) => setProgramInput(e.target.value)}
                      placeholder="Program input (one per line)..."
                      className="w-full h-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFA116] resize-none"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <pre className="absolute inset-0 p-3 bg-gray-50 dark:bg-gray-800 rounded-md overflow-auto text-gray-900 dark:text-white font-mono text-sm scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 whitespace-pre-wrap">
                      {output}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Page Component */}
      <HelpPage isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Theme Toggle */}
      <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6 lg:bottom-8 lg:right-8">
        <ThemeToggle />
      </div>
    </div>
  );
};

const App = () => {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
};

export default App;