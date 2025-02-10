import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import io from 'socket.io-client';
import Peer from 'simple-peer/simplepeer.min.js';
import axios from 'axios';
import RoomEntry from './components/RoomEntry';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './context/ThemeContext';

const socket = io('http://localhost:3000');

const App = () => {
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
  const [voiceParticipants, setVoiceParticipants] = useState(new Set());
  
  const peerRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!isInRoom) return;

    socket.emit('join-room', { roomId, language, username });

    socket.on('room-state', ({ language: roomLanguage, code: roomCode, participants: roomParticipants, isHost }) => {
      setLanguage(roomLanguage);
      setCode(roomCode);
      setParticipants(roomParticipants);
      setIsHost(isHost);
    });

    socket.on('error', ({ message }) => {
      alert(message);
      setIsInRoom(false);
    });

    socket.on('user-joined', ({ username, participants: newParticipants }) => {
      setParticipants(newParticipants);
    });

    socket.on('user-left', ({ username, participants: newParticipants }) => {
      setParticipants(newParticipants);
    });

    socket.on('code-update', (newCode) => {
      setCode(newCode);
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

    socket.on('voice-participant-joined', ({ userId, username }) => {
      setVoiceParticipants(prev => new Set([...prev, { userId, username }]));
    });

    socket.on('voice-participant-left', ({ userId }) => {
      setVoiceParticipants(prev => {
        const newSet = new Set(prev);
        newSet.delete([...newSet].find(p => p.userId === userId));
        return newSet;
      });
    });

    socket.on('call-accepted', (signal) => {
      if (peerRef.current) {
        peerRef.current.signal(signal);
      }
    });

    return () => {
      socket.off('code-update');
      socket.off('receive-message');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('incoming-call');
      socket.off('language-changed');
      socket.off('room-ended');
      socket.off('voice-participant-joined');
      socket.off('voice-participant-left');
      socket.off('call-accepted');
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      handleLeaveCall();
    };
  }, [isInRoom, roomId]);

  const handleJoinRoom = (newRoomId, selectedLanguage, userUsername) => {
    setRoomId(newRoomId);
    if (selectedLanguage) setLanguage(selectedLanguage);
    setUsername(userUsername);
    setIsInRoom(true);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit('code-change', { roomId, code: newCode });
  };

  const handleCompile = async () => {
    try {
      const response = await axios.post('http://localhost:3000/compile', {
        code,
        language,
        input: programInput
      });
      setOutput(response.data.output || response.data.error);
    } catch (error) {
      setOutput('Compilation error: ' + error.message);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      socket.emit('chat-message', {
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
    socket.emit('leave-room', { roomId });
    setIsInRoom(false);
    setMessages([]);
    setCode('// Start coding here...');
    setOutput('');
    setIsCallActive(false);
    setPeerRef(null);
  };

  const handleEndRoom = () => {
    if (isHost) {
      socket.emit('end-room', { roomId });
      handleLeaveRoom();
    }
  };

  const startCall = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false  // Explicitly disable video
      });

      if (!mediaStream) {
        throw new Error('Failed to get audio stream');
      }

      setStream(mediaStream);

      const newPeer = new Peer({
        initiator: true,
        trickle: false,
        stream: mediaStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      newPeer.on('signal', (data) => {
        socket.emit('call-user', {
          userToCall: roomId,
          signalData: data,
          roomId
        });
      });

      newPeer.on('stream', (remoteStream) => {
        try {
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.addEventListener('canplay', () => {
            audio.play().catch(err => console.error('Audio play error:', err));
          });
        } catch (err) {
          console.error('Error playing remote stream:', err);
        }
      });

      newPeer.on('error', (err) => {
        console.error('Peer error:', err);
        handleLeaveCall();
      });

      newPeer.on('close', () => {
        handleLeaveCall();
      });

      peerRef.current = newPeer;
      setIsCallActive(true);
      socket.emit('join-voice', { roomId });
    } catch (err) {
      console.error('Call start error:', err);
      if (err.name === 'NotAllowedError') {
        alert('Microphone access was denied. Please allow microphone access and try again.');
      } else {
        alert('Failed to start voice chat. Please try again.');
      }
      handleLeaveCall();
    }
  };

  const handleIncomingCall = async (from, signal) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false
      });

      if (!mediaStream) {
        throw new Error('Failed to get audio stream');
      }

      setStream(mediaStream);

      const newPeer = new Peer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      newPeer.on('signal', (data) => {
        socket.emit('answer-call', { signal: data, to: from });
      });

      newPeer.on('stream', (remoteStream) => {
        try {
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.addEventListener('canplay', () => {
            audio.play().catch(err => console.error('Audio play error:', err));
          });
        } catch (err) {
          console.error('Error playing remote stream:', err);
        }
      });

      newPeer.on('error', (err) => {
        console.error('Peer error:', err);
        handleLeaveCall();
      });

      newPeer.on('close', () => {
        handleLeaveCall();
      });

      newPeer.signal(signal);
      peerRef.current = newPeer;
      setIsCallActive(true);
      socket.emit('join-voice', { roomId });
    } catch (err) {
      console.error('Call accept error:', err);
      if (err.name === 'NotAllowedError') {
        alert('Microphone access was denied. Please allow microphone access and try again.');
      } else {
        alert('Failed to join voice chat. Please try again.');
      }
      handleLeaveCall();
    }
  };

  const handleLeaveCall = () => {
    try {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
        setStream(null);
      }
      setIsCallActive(false);
      socket.emit('leave-voice', { roomId });
    } catch (err) {
      console.error('Error leaving call:', err);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    if (isHost) {
      socket.emit('change-language', { roomId, newLanguage });
    }
  };

  if (!isInRoom) {
    return (
      <>
        <ThemeToggle />
        <RoomEntry onJoinRoom={handleJoinRoom} />
      </>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#F5F5F5] dark:bg-[#1A1A1A] transition-colors">
      {/* Theme Toggle - Moved to a better position */}
      <div className="fixed top-4 left-4 z-50">
        <ThemeToggle />
      </div>
      
      {/* Left Panel - Sidebar */}
      <div className="w-full lg:w-[25%] h-1/2 lg:h-full bg-white dark:bg-[#282828] border-b lg:border-r border-gray-200 dark:border-gray-700 p-4">
        {/* Room Info Card */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Room ID: <span className="font-mono text-[#FFA116]">{roomId}</span>
            </h3>
            {isHost ? (
              <button
                onClick={handleEndRoom}
                className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
              >
                End Room
              </button>
            ) : (
              <button
                onClick={handleLeaveRoom}
                className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
              >
                Leave Room
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <span className="text-sm">Language:</span>
            <span className="font-medium text-[#FFA116]">{language}</span>
            {isHost && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">Host</span>}
          </div>
          <div className="mt-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Participants ({participants.length})</p>
            <ul className="mt-2 space-y-1">
              {participants.map((name, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Chat Section */}
        <div className="bg-white dark:bg-[#282828] rounded-lg shadow-sm h-[calc(50%-6rem)]">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Chat</h2>
          </div>
          <div className="flex flex-col h-[calc(100%-4rem)]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, index) => (
                <div key={index} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {msg.sender === 'me' ? 'You' : msg.username}
                  </span>
                  <div className={`px-3 py-2 rounded-lg max-w-[80%] ${
                    msg.sender === 'me'
                      ? 'bg-[#FFA116] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFA116]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FFA116] text-white rounded-md hover:bg-[#FF9100] transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Voice Channel */}
        <div className="mt-4 bg-white dark:bg-[#282828] rounded-lg p-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Voice Channel</h2>
          <button
            onClick={isCallActive ? handleLeaveCall : startCall}
            className={`w-full py-2 rounded-md transition-colors ${
              isCallActive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[#FFA116] hover:bg-[#FF9100] text-white'
            }`}
          >
            {isCallActive ? 'Leave Voice' : 'Join Voice'}
          </button>
          <div className="mt-3">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Voice Participants
            </h3>
            <ul className="space-y-2">
              {[...voiceParticipants].map(({ userId, username }) => (
                <li
                  key={userId}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {username}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right Panel - Editor */}
      <div className="w-full lg:w-[75%] h-1/2 lg:h-full flex flex-col p-4 bg-[#F5F5F5] dark:bg-[#1A1A1A]">
        <div className="flex-1 bg-white dark:bg-[#282828] rounded-lg shadow-sm mb-4 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Code Editor</h2>
                {isHost ? (
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FFA116]"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                  </select>
                ) : (
                  <span className="text-gray-600 dark:text-gray-300">
                    Language: {language}
                  </span>
                )}
              </div>
              <button
                onClick={handleCompile}
                className="px-4 py-2 bg-[#FFA116] text-white rounded-md hover:bg-[#FF9100] transition-colors"
              >
                Run Code
              </button>
            </div>
          </div>
          <div className="h-[calc(100%-4rem)]">
            <Editor
              height="100%"
              defaultLanguage={language}
              value={code}
              onChange={handleCodeChange}
              theme={isDark ? "vs-dark" : "light"}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
              }}
            />
          </div>
        </div>

        {/* Output Section */}
        <div className="h-[30%] bg-white dark:bg-[#282828] rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Output</h2>
          <div className="flex flex-col h-[calc(100%-2rem)] gap-3">
            <div className="flex-1">
              <textarea
                value={programInput}
                onChange={(e) => setProgramInput(e.target.value)}
                placeholder="Program input (one per line)..."
                className="w-full h-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFA116] resize-none"
              />
            </div>
            <div className="flex-1">
              <pre className="h-full p-3 bg-gray-50 dark:bg-gray-800 rounded-md overflow-auto text-gray-900 dark:text-white font-mono text-sm">
                {output}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;