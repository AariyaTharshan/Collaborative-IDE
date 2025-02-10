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
  const [voiceParticipants, setVoiceParticipants] = useState(new Set());
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
      socket.off('room-state');
      socket.off('error');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('code-update');
      socket.off('receive-message');
      socket.off('incoming-call');
      socket.off('language-changed');
      socket.off('room-ended');
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
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCallActive(true);

      // Notify others that we've joined voice
      socketRef.current?.emit('join-voice', { roomId });

      // Listen for new peers joining
      socketRef.current?.on('user-joined-voice', async ({ userId }) => {
        if (userId !== socketRef.current.id) {
          const peerConnection = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });

          // Add our local stream
          localStreamRef.current.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStreamRef.current);
          });

          // Create and send offer
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socketRef.current.emit('voice-offer', {
            target: userId,
            caller: socketRef.current.id,
            sdp: peerConnection.localDescription
          });

          // Handle ICE candidates
          peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit('voice-ice-candidate', {
                target: userId,
                candidate: event.candidate
              });
            }
          };

          // Handle incoming stream
          peerConnection.ontrack = (event) => {
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.play().catch(console.error);
          };

          setPeerConnections(prev => new Map(prev.set(userId, peerConnection)));
        }
      });

      // Handle incoming voice offers
      socketRef.current?.on('voice-offer', async ({ sdp, caller }) => {
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        // Add our local stream
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });

        // Set remote description
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socketRef.current.emit('voice-answer', {
          target: caller,
          sdp: peerConnection.localDescription
        });

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit('voice-ice-candidate', {
              target: caller,
              candidate: event.candidate
            });
          }
        };

        // Handle incoming stream
        peerConnection.ontrack = (event) => {
          const audio = new Audio();
          audio.srcObject = event.streams[0];
          audio.play().catch(console.error);
        };

        setPeerConnections(prev => new Map(prev.set(caller, peerConnection)));
      });

      // Handle answers
      socketRef.current?.on('voice-answer', async ({ sdp, answerer }) => {
        const peerConnection = peerConnections.get(answerer);
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      });

      // Handle ICE candidates
      socketRef.current?.on('voice-ice-candidate', async ({ candidate, sender }) => {
        const peerConnection = peerConnections.get(sender);
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

    } catch (err) {
      console.error('Failed to start call:', err);
      alert('Failed to access microphone. Please ensure microphone permissions are granted.');
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
    // Stop all tracks in local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnections.forEach(connection => {
      connection.close();
    });
    setPeerConnections(new Map());

    setIsCallActive(false);
    setStream(null);
    socketRef.current?.emit('leave-voice', { roomId });
  };

  const handleLanguageChange = (newLanguage) => {
    if (isHost) {
      socketRef.current?.emit('change-language', { roomId, newLanguage });
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
                className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
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

      {/* Add HelpPage component at the end */}
      <HelpPage isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

export default App;