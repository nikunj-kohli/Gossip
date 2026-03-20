import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import io from 'socket.io-client';
import { 
  getConversations, 
  getMessages, 
  sendMessage,
  startConversation,
  getFriends
} from '../api';

const MessagesPage = () => {
  const { user } = React.useContext(AuthContext);
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [messageType, setMessageType] = useState('text');
  
  const messagesEndRef = React.useRef(null);
  const socketRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchConversations();
    fetchFriends();
  }, []);

  useEffect(() => {
    // If conversationId is in URL, select that conversation
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id == conversationId);
      if (conversation) {
        setSelectedConversation(conversation);
      } else {
        // If conversation not found, it might be a new conversation with a user
        // Try to start conversation with the user
        handleStartConversation(conversationId);
      }
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      
      // Initialize Socket.IO connection for real-time updates
      if (!socketRef.current) {
        const token = localStorage.getItem('token');
        
        // Create socket with better error handling
        socketRef.current = io('http://localhost:5000', {
          auth: { token },
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        // Handle connection errors
        socketRef.current.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
        });

        socketRef.current.on('connect', () => {
          console.log('Socket connected successfully');
          // Join conversation room after successful connection
          socketRef.current.emit('join:conversations', [selectedConversation.id]);
        });

        // Listen for new messages
        socketRef.current.on('message:received', (newMessage) => {
          console.log('Received message from server:', newMessage);
          console.log('Message created_at:', newMessage.created_at);
          console.log('Parsed date:', new Date(newMessage.created_at));
          
          if (newMessage.conversationId === selectedConversation.id) {
            // Optimistic update - add message instantly
            setMessages(prev => [...prev, newMessage]);
            
            // Update conversation list silently in background
            updateConversationInBackground(selectedConversation.id, newMessage);
          }
        });

        // Listen for typing indicators
        socketRef.current.on('typing:update', (data) => {
          if (data.channelId === selectedConversation.id && data.channelType === 'conversation') {
            console.log('User typing:', data.users);
          }
        });
        
        // Listen for conversation updates (new messages, read status, etc.)
        socketRef.current.on('conversation:update', (data) => {
          if (data.conversationId === selectedConversation.id) {
            // Update conversation metadata silently
            updateConversationMetadata(data.conversationId, data);
          }
        });
      } else if (socketRef.current.connected) {
        // If socket already exists and is connected, join the room
        socketRef.current.emit('join:conversations', [selectedConversation.id]);
      }
    }
    
    return () => {
      // Cleanup on unmount or conversation change
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [selectedConversation]);

  // Background update functions (no loading states)
  const updateConversationInBackground = async (conversationId, lastMessage) => {
    try {
      // Update the conversation in the list without showing loading
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            last_message: lastMessage.content,
            last_message_at: lastMessage.timestamp,
            unread_count: conv.unread_count + 1
          };
        }
        return conv;
      }));
    } catch (error) {
      console.log('Background update failed, will sync later:', error);
    }
  };

  const updateConversationMetadata = (conversationId, metadata) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId) {
        return { ...conv, ...metadata };
      }
      return conv;
    }));
  };

  // Remove auto-refresh - Socket.io should handle real-time updates
// useEffect(() => {
//   const interval = setInterval(() => {
//     fetchConversations();
//   }, 30000); 
//   return () => clearInterval(interval);
// }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const { data, error } = await getConversations();
      
      if (error) {
        console.error('Error fetching conversations:', error);
        setConversations([]);
      } else {
        // Handle both direct array and nested conversations array
        const conversationsList = data?.conversations || data || [];
        setConversations(conversationsList);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const { data, error } = await getFriends();
      
      if (error) {
        console.error('Error fetching friends:', error);
        setFriends([]);
      } else {
        setFriends(data || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      setFriends([]);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      setLoading(true);
      const { data, error } = await getMessages(conversationId);
      
      if (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      } else {
        console.log('Fetched messages from API:', data);
        data.forEach((msg, index) => {
          console.log(`Message ${index}:`, msg.created_at, '->', new Date(msg.created_at));
        });
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    // Create optimistic message (appears instantly)
    const now = new Date();
    const optimisticMessage = {
      id: 'temp-' + Date.now(), // Temporary ID
      content: newMessage,
      sender_id: user.id, // Use snake_case to match database format
      conversationId: selectedConversation.id,
      messageType: messageType,
      created_at: now.toISOString(), // Keep ISO format for consistency
      localTime: now, // Store local time for formatting
      isOptimistic: true // Mark as optimistic
    };

    // Add message to UI instantly
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setMessageType('text');
    
    // Scroll to bottom immediately
    setTimeout(() => scrollToBottom(), 100);

    try {
      // Send to backend in background
      const { data, error } = await sendMessage(selectedConversation.id, {
        content: optimisticMessage.content,
        messageType: messageType
      });

      if (error) {
        // Remove optimistic message and show error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        console.error('Error sending message:', error);
        return;
      }

      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id ? data : msg
      ));

    } catch (error) {
      // Remove optimistic message on network error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      console.error('Error sending message:', error);
    }
  };

  const handleStartConversation = async (userId) => {
    try {
      const { data, error } = await startConversation(userId);
      
      if (error) {
        console.error('Error starting conversation:', error);
        alert('Failed to start conversation');
        return;
      }

      // Add the new conversation to the list and select it
      setConversations([data, ...conversations]);
      setSelectedConversation(data);
      setShowNewConversation(false);
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation');
    }
  };

  const handleStartConversationWithFriend = (friend) => {
    const friendId = friend.id || friend.user_id;
    if (!friend || !friendId) {
      console.error('Invalid friend data:', friend);
      alert('Invalid friend selected');
      return;
    }
    handleStartConversation(friendId);
  };

  const mockConversations = [
    {
      id: 1,
      participant: {
        id: 1,
        username: 'johndoe',
        displayName: 'John Doe',
        avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3B82F6&color=fff'
      },
      lastMessage: 'Hey, how are you doing?',
      lastMessageTime: '2m ago',
      unreadCount: 2,
      isOnline: true
    },
    {
      id: 2,
      participant: {
        id: 2,
        username: 'janesmith',
        displayName: 'Jane Smith',
        avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=EC4899&color=fff'
      },
      lastMessage: 'See you tomorrow!',
      lastMessageTime: '1h ago',
      unreadCount: 0,
      isOnline: false
    },
    {
      id: 3,
      participant: {
        id: 3,
        username: 'mikejohnson',
        displayName: 'Mike Johnson',
        avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson&background=10B981&color=fff'
      },
      lastMessage: 'Did you see the latest post?',
      lastMessageTime: '3h ago',
      unreadCount: 1,
      isOnline: true
    }
  ];

  const mockMessages = {
    1: [
      {
        id: 1,
        sender: {
          id: 1,
          username: 'johndoe',
          displayName: 'John Doe',
          avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3B82F6&color=fff'
        },
        content: 'Hey, how are you doing?',
        timestamp: '2026-03-18T10:30:00Z',
        type: 'received'
      },
      {
        id: 2,
        sender: user,
        content: "I'm doing great! Just working on some projects.",
        timestamp: '2026-03-18T10:32:00Z',
        type: 'sent'
      },
      {
        id: 3,
        sender: {
          id: 1,
          username: 'johndoe',
          displayName: 'John Doe',
          avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3B82F6&color=fff'
        },
        content: 'That sounds awesome! What kind of projects?',
        timestamp: '2026-03-18T10:33:00Z',
        type: 'received'
      }
    ],
    2: [
      {
        id: 4,
        sender: user,
        content: 'Are we still on for tomorrow?',
        timestamp: '2026-03-18T09:00:00Z',
        type: 'sent'
      },
      {
        id: 5,
        sender: {
          id: 2,
          username: 'janesmith',
          displayName: 'Jane Smith',
          avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=EC4899&color=fff'
        },
        content: 'See you tomorrow!',
        timestamp: '2026-03-18T09:15:00Z',
        type: 'received'
      }
    ],
    3: [
      {
        id: 6,
        sender: {
          id: 3,
          username: 'mikejohnson',
          displayName: 'Mike Johnson',
          avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson&background=10B981&color=fff'
        },
        content: 'Did you see the latest post in Tech Talk?',
        timestamp: '2026-03-18T08:00:00Z',
        type: 'received'
      }
    ]
  };

  const formatTime = (timestamp, localTime) => {
    // Use local time for optimistic messages, otherwise convert UTC to India time
    let date;
    if (localTime) {
      date = localTime;
      console.log('Using local time for optimistic message:', date);
    } else {
      // Convert UTC timestamp to India time (UTC+05:30)
      const utcDate = new Date(timestamp);
      console.log('UTC timestamp from server:', timestamp);
      console.log('UTC date object:', utcDate);
      // Convert to India time by adding 5.5 hours
      const indiaTime = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
      date = indiaTime;
      console.log('Converted to India time:', indiaTime);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid time';
      }
    }
    
    const now = new Date(); // Current local time (should be India time)
    console.log('Current local time:', now);
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    // For today's messages, show time only
    if (date.toDateString() === now.toDateString()) {
      const formattedTime = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata' // Force India timezone
      });
      console.log('Formatted time (today):', formattedTime);
      return formattedTime;
    }
    
    // For yesterday's messages, show "Yesterday" with time
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata' // Force India timezone
      });
    }
    
    // For messages within the last week, show day name with time
    if (diffInDays < 7) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata' // Force India timezone
      });
    }
    
    // For older messages, show full date with time
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata' // Force India timezone
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/feed" className="text-2xl font-bold text-blue-600">Gossip</Link>
              <span className="mx-3 text-gray-300">/</span>
              <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/feed" className="text-gray-600 hover:text-blue-600">Feed</Link>
              <Link to="/communities" className="text-gray-600 hover:text-blue-600">Communities</Link>
              <Link to="/friends" className="text-gray-600 hover:text-blue-600">Friends</Link>
              <div className="flex items-center space-x-2">
                <img
                  className="h-8 w-8 rounded-full"
                  src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.displayName || user?.username}&background=3B82F6&color=fff`}
                  alt={user?.displayName || user?.username}
                />
                <span className="text-sm font-medium text-gray-700">{user?.displayName || user?.username}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ height: '600px' }}>
          <div className="flex h-full">
            {/* Conversations List */}
            <div className="w-80 border-r border-gray-200 overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
                  <button
                    onClick={() => setShowNewConversation(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full"
                    title="Start new conversation"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {conversations.map((conversation) => {
                  // Get the first participant (for 1-on-1 conversations)
                  const participant = conversation.participants && conversation.participants[0];
                  if (!participant) return null;
                  
                  return (
                    <div
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="relative">
                          <img
                            className="h-12 w-12 rounded-full"
                            src={participant.avatar_url || `https://ui-avatars.com/api/?name=${participant.display_name || participant.username}&background=3B82F6&color=fff`}
                            alt={participant.display_name || participant.username}
                          />
                          {conversation.isOnline && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-white"></span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {participant.display_name || participant.username}
                            </h3>
                            <span className="text-xs text-gray-400 font-medium">{formatTime(conversation.last_message_at)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-gray-600 truncate">{conversation.last_message || 'No messages yet'}</p>
                            {conversation.unread_count > 0 && (
                              <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                {conversation.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      {(() => {
                        const participant = selectedConversation.participants && selectedConversation.participants[0];
                        if (!participant) return null;
                        return (
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <img
                                className="h-10 w-10 rounded-full"
                                src={participant.avatar_url || `https://ui-avatars.com/api/?name=${participant.display_name || participant.username}&background=3B82F6&color=fff`}
                                alt={participant.display_name || participant.username}
                              />
                              {selectedConversation.isOnline && (
                                <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-white"></span>
                              )}
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{participant.display_name || participant.username}</h3>
                              <p className="text-sm text-gray-500">
                                {selectedConversation.isOnline ? 'Active now' : 'Offline'}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                      <button
                        onClick={() => fetchMessages(selectedConversation.id)}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                        title="Refresh messages"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => {
                      const getMessageTypeIcon = (type) => {
                        const icons = {
                          'text': '',
                          'announcement': '📢',
                          'question': '❓',
                          'urgent': '🚨',
                          'casual': '💬',
                          'work': '💼',
                          'personal': '👤'
                        };
                        return icons[type] || '';
                      };
                      
                      const getMessageTypeColor = (type) => {
                        const colors = {
                          'text': 'bg-gray-200 text-gray-900',
                          'announcement': 'bg-blue-100 text-blue-900 border border-blue-200',
                          'question': 'bg-yellow-100 text-yellow-900 border border-yellow-200',
                          'urgent': 'bg-red-100 text-red-900 border border-red-200',
                          'casual': 'bg-green-100 text-green-900 border border-green-200',
                          'work': 'bg-purple-100 text-purple-900 border border-purple-200',
                          'personal': 'bg-pink-100 text-pink-900 border border-pink-200'
                        };
                        return colors[type] || 'bg-gray-200 text-gray-900';
                      };
                      
                      return (
                        <div
                          key={message.id}
                          className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs lg:max-w-md ${message.sender_id === user?.id ? 'order-2' : 'order-1'}`}>
                            <div
                              className={`px-4 py-2 rounded-lg ${getMessageTypeColor(message.message_type)}`}
                            >
                              {getMessageTypeIcon(message.message_type) && (
                                <span className="mr-1">{getMessageTypeIcon(message.message_type)}</span>
                              )}
                              <p className="text-sm">{message.content}</p>
                            </div>
                            <p className={`text-xs text-gray-400 mt-1 font-medium ${message.sender_id === user?.id ? 'text-right' : 'text-left'}`}>
                              {formatTime(message.created_at, message.localTime)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {/* Auto-scroll anchor */}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-gray-200">
                    <div className="space-y-2">
                      {/* Message Type Selector */}
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Type:</label>
                        <select
                          value={messageType}
                          onChange={(e) => setMessageType(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="text">Text</option>
                          <option value="announcement">📢 Announcement</option>
                          <option value="question">❓ Question</option>
                          <option value="urgent">🚨 Urgent</option>
                          <option value="casual">💬 Casual</option>
                          <option value="work">💼 Work</option>
                          <option value="personal">👤 Personal</option>
                        </select>
                      </div>
                      
                      {/* Message Input */}
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Type a message..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleSendMessage}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-gray-400 text-lg mb-4">Select a conversation</div>
                    <p className="text-gray-500 mb-4">Choose a friend from the list to start messaging</p>
                    <button
                      onClick={() => setShowNewConversation(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Start New Conversation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Start New Conversation</h3>
              <button
                onClick={() => setShowNewConversation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {friends.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No friends found. Add friends first to start messaging.</p>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => {
                  const friendId = friend.id || friend.user_id;
                  const friendName = friend.display_name || friend.username;
                  const friendUsername = friend.username;
                  const friendAvatar = friend.avatar_url || `https://ui-avatars.com/api/?name=${friendName}&background=3B82F6&color=fff`;
                  
                  return (
                    <div
                      key={friendId}
                      onClick={() => handleStartConversationWithFriend(friend)}
                      className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <img
                        className="h-10 w-10 rounded-full"
                        src={friendAvatar}
                        alt={friendName}
                      />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {friendName}
                        </h4>
                        <p className="text-xs text-gray-500">@{friendUsername}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
