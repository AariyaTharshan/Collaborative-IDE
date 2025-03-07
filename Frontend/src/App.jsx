import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import axios from 'axios';
import RoomEntry from './components/RoomEntry';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './context/ThemeContext';
import HelpPage from './components/HelpPage';

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
  const [voiceParticipants, setVoiceParticipants] = useState(new Map());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [peerConnections, setPeerConnections] = useState(new Map());
  const localStreamRef = useRef(null);
  
  const peerRef = useRef(null);
  const { isDark } = useTheme();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_BACKEND_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        transports: ['websocket']
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isInRoom || !socketRef.current) return;

    const socket = socketRef.current;
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
    socketRef.current?.emit('code-change', { roomId, code: newCode });
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
      socketRef.current?.emit('chat-message', {
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
    socketRef.current?.emit('leave-room', { roomId });
    setIsInRoom(false);
    setMessages([]);
    setCode('// Start coding here...');
    setOutput('');
    setIsCallActive(false);
    peerRef.current = null;
  };

  const handleEndRoom = () => {
    if (isHost) {
      socketRef.current?.emit('end-room', { roomId });
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

      // Add self to voice participants and notify others
      socketRef.current.emit('join-voice', { 
        roomId,
        userId: socketRef.current.id,
        username 
      });

      // Listen for new peers joining
      socketRef.current?.on('user-joined-voice', ({ userId, username }) => {
        console.log('User joined voice:', userId, username);
        setVoiceParticipants(prev => new Map(prev).set(userId, username));
        
        if (userId !== socketRef.current.id) {
          const peerConnection = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });

          // Add our local stream
          mediaStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, mediaStream);
          });

          // Create and send offer
          peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
              socketRef.current?.emit('voice-offer', {
                target: userId,
                caller: socketRef.current.id,
                sdp: peerConnection.localDescription
              });
            });

          setPeerConnections(prev => new Map(prev).set(userId, peerConnection));
        }
      });

      // Handle voice offers
      socketRef.current?.on('voice-offer', async ({ sdp, caller }) => {
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        // Add our local stream
        mediaStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, mediaStream);
        });

        // Set remote description
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socketRef.current?.emit('voice-answer', {
          target: caller,
          sdp: peerConnection.localDescription
        });

        setPeerConnections(prev => new Map(prev).set(caller, peerConnection));
      });

      // Handle voice answers
      socketRef.current?.on('voice-answer', async ({ sdp, answerer }) => {
        const peerConnection = peerConnections.get(answerer);
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      });

      // Handle participant leaving voice
      socketRef.current?.on('voice-participant-left', ({ userId }) => {
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
        socketRef.current?.emit('answer-call', { signal: data, to: from });
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
      socketRef.current?.emit('join-voice', { roomId });

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
      socketRef.current.emit('leave-voice', { 
        roomId,
        userId: socketRef.current.id 
      });

    } catch (error) {
      console.error('Error leaving call:', error);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    if (isHost) {
      socketRef.current?.emit('change-language', { roomId, newLanguage });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F5F5] dark:bg-[#1A1A1A] transition-colors">
      {!isInRoom ? (
        <RoomEntry onJoinRoom={handleJoinRoom} />
      ) : (
        <div className="flex flex-col lg:flex-row h-full relative">
          {/* Left Panel - Sidebar */}
          <div className="w-full lg:w-[25%] h-[30vh] lg:h-full bg-white dark:bg-[#282828] border-b lg:border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Room Info */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Room ID: <span className="font-mono text-[#FFA116]">{roomId}</span>
                </h3>
                {isHost ? (
                  <button onClick={handleEndRoom} className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600">
                    End Room
                  </button>
                ) : (
                  <button onClick={handleLeaveRoom} className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600">
                    Leave Room
                  </button>
                )}
              </div>
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
                <ul className="space-y-1">
                  {participants.map((name, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                  Voice Participants ({voiceParticipants.size})
                </h3>
                <ul className="space-y-1">
                  {Array.from(voiceParticipants.entries()).map(([userId, name]) => (
                    <li key={userId} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-[#FFA116]"></span>
                      {name}
                      {userId === socketRef.current.id && " (You)"}
                    </li>
                  ))}
                </ul>
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

          {/* Right Panel - Editor */}
          <div className="w-full lg:w-[75%] h-[70vh] lg:h-full flex flex-col">
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsHelpOpen(true)}
                      className="px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Snippets</span>
                    </button>
                    <button 
                      onClick={handleCompile}
                      className="px-4 py-2 bg-[#FFA116] text-white rounded-md hover:bg-[#FF9100] transition-colors"
                    >
                      Run Code
                    </button>
                  </div>
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
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: true,
                    snippetSuggestions: "inline",
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
                    },
                    'editor.snippetSuggestions': 'top',
                  }}
                  beforeMount={(monaco) => {
                    monaco.languages.registerCompletionItemProvider('javascript', {
                      provideCompletionItems: () => {
                        return {
                          suggestions: [
                            {
                              label: 'cl',
                              kind: monaco.languages.CompletionItemKind.Snippet,
                              insertText: 'console.log(${1:value});',
                              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                              detail: 'Console log statement',
                              documentation: 'Prints to console'
                            },
                            {
                              label: 'fn',
                              kind: monaco.languages.CompletionItemKind.Snippet,
                              insertText: [
                                'function ${1:name}(${2:params}) {',
                                '\t${3:// code here}',
                                '}'
                              ].join('\n'),
                              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                              detail: 'Function declaration'
                            },
                            {
                              label: 'afn',
                              kind: monaco.languages.CompletionItemKind.Snippet,
                              insertText: 'const ${1:name} = (${2:params}) => {\n\t${3:// code here}\n}',
                              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                              detail: 'Arrow function'
                            },
                          ]
                        };
                      }
                    });

                    monaco.languages.registerCompletionItemProvider('python', {
                      provideCompletionItems: () => {
                        return {
                          suggestions: [
                            {
                              label: 'def',
                              kind: monaco.languages.CompletionItemKind.Snippet,
                              insertText: 'def ${1:function_name}(${2:params}):\n\t${3:pass}',
                              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                              detail: 'Function definition'
                            },
                            {
                              label: 'class',
                              kind: monaco.languages.CompletionItemKind.Snippet,
                              insertText: 'class ${1:ClassName}:\n\tdef __init__(self):\n\t\t${2:pass}',
                              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                              detail: 'Class definition'
                            },
                          ]
                        };
                      }
                    });

                    monaco.languages.registerCompletionItemProvider('cpp', {
                      provideCompletionItems: () => {
                        return {
                          suggestions: [
                            {
                              label: 'cp',
                              kind: monaco.languages.CompletionItemKind.Snippet,
                              insertText: [
                                '#include <bits/stdc++.h>',
                                'using namespace std;',
                                '',
                                'int main() {',
                                '\tios::sync_with_stdio(0);',
                                '\tcin.tie(0);',
                                '\t${1:// code here}',
                                '\treturn 0;',
                                '}'
                              ].join('\n'),
                              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                              detail: 'Competitive programming template'
                            },
                          ]
                        };
                      }
                    });

                    monaco.languages.registerCompletionItemProvider('*', {
                      triggerCharacters: ['.', ' '],
                      provideCompletionItems: (model, position) => {
                        const lineContent = model.getLineContent(position.lineNumber);
                        const wordUntilPosition = model.getWordUntilPosition(position);
                        
                        const suggestions = [];
                        
                        if (lineContent.includes('for')) {
                          suggestions.push({
                            label: 'Loop template',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: '(let i = 0; i < ${1:length}; i++) {\n\t${2:// code}\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: 'For loop with iterator',
                            sortText: '0'
                          });
                        }

                        if (lineContent.includes('array') || lineContent.includes('[]')) {
                          suggestions.push({
                            label: 'Array methods',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: '.${1|map,filter,reduce,forEach,find,some,every|}((${2:item}) => ${3:// code})',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: 'Common array methods',
                            sortText: '0'
                          });
                        }

                        return { suggestions };
                      }
                    });
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
      )}

      {/* Help Page Component */}
      <HelpPage isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Theme Toggle - Positioned at bottom right */}
      <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6 lg:bottom-8 lg:right-8">
        <ThemeToggle />
      </div>
    </div>
  );
};

export default App;