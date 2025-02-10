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
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-white dark:bg-gray-900 transition-colors">
      <ThemeToggle />
      
      {/* Left Panel - Make it narrower */}
      <div className="w-full lg:w-[25%] h-1/2 lg:h-full bg-gray-50 dark:bg-gray-800 border-b lg:border-r border-gray-200 dark:border-gray-700 p-3">
        <div className="mb-3 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-300">
              Room ID: {roomId}
            </h3>
            {isHost ? (
              <button
                onClick={handleEndRoom}
                className="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
              >
                End Room
              </button>
            ) : (
              <button
                onClick={handleLeaveRoom}
                className="px-2 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
              >
                Leave Room
              </button>
            )}
          </div>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Language: {language} {isHost && <span className="text-xs text-blue-500">(Host)</span>}
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <p>Participants ({participants.length}):</p>
            <ul className="list-disc pl-5">
              {participants.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Chat and Call Section - Reduced heights */}
        <div className="h-full flex flex-col space-y-3">
          <div className="flex-2 bg-white dark:bg-gray-700 rounded-lg p-3 shadow-md flex flex-col h-[250px]">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Chat</h2>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col space-y-2 min-h-0">
              {messages.map((msg, index) => (
                <div key={index} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                    {msg.sender === 'me' ? 'You' : msg.username}
                  </div>
                  <div 
                    className={`p-1.5 rounded-xl max-w-[80%] break-words text-sm ${
                      msg.sender === 'me' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 dark:bg-gray-600 text-black dark:text-white'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button 
                type="submit"
                className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
              >
                Send
              </button>
            </form>
          </div>
          
          <div className="flex-1 bg-white dark:bg-gray-700 rounded-lg p-3 shadow-md">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Voice Channel</h2>
            <div className="mb-3">
              <button 
                onClick={isCallActive ? handleLeaveCall : startCall}
                className={`px-3 py-1.5 rounded transition-colors text-sm ${
                  isCallActive 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-white`}
              >
                {isCallActive ? 'Leave Voice' : 'Join Voice'}
              </button>
            </div>
            
            <div className="mt-2">
              <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Voice Participants
              </h3>
              <ul className="space-y-0.5">
                {[...voiceParticipants].map(({ userId, username }) => (
                  <li 
                    key={userId}
                    className="flex items-center text-xs text-gray-700 dark:text-gray-300"
                  >
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                    {username}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Make it wider */}
      <div className="w-full lg:w-[75%] h-1/2 lg:h-full flex flex-col p-3">
        <div className="flex-[3] bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-md flex flex-col">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Code Editor</h2>
            {isHost ? (
              <select 
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
            ) : (
              <div className="px-2 py-2 text-gray-600 dark:text-gray-300">
                Language: {language}
              </div>
            )}
            <button 
              onClick={handleCompile}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Run Code
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage={language}
              value={code}
              onChange={handleCodeChange}
              theme={isDark ? "vs-dark" : "light"}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-700 rounded-lg p-4 shadow-md overflow-auto">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Output</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Program Input (one input per line)
            </label>
            <textarea
              value={programInput}
              onChange={(e) => setProgramInput(e.target.value)}
              placeholder="Enter program inputs here..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white h-20"
            />
          </div>
          
          <pre className="bg-gray-100 dark:bg-gray-800 p-2.5 rounded overflow-x-auto text-gray-900 dark:text-white max-h-[200px] overflow-y-auto">
            {output}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default App;