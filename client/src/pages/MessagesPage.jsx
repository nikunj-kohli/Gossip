import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { 
  getConversations, 
  getMessages, 
  sendMessage, 
  getFriends, 
  startConversation 
} from '../api';

const MessagesPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState('text');
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [user, setUser] = useState(null);
  
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const fetchTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!selectedConversation) return;
    
    try {
      await fetchMessages(selectedConversation.id);
      await fetchConversations();
    } catch (error) {
      console.error('Error refreshing messages:', error);
    }
  }, [selectedConversation]);

  const fetchMessages = useCallback(async (conversationId) => {
    try {
      setLoading(true);
      const response = await getMessages(conversationId);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      console.log('MessagesPage: Fetching conversations...');
      const response = await getConversations();
      console.log('MessagesPage: Conversations response:', response);
      setConversations(response.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const response = await getFriends();
      setFriends(response.data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
      setFriends([]);
    }
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const now = new Date();
    const optimisticMessage = {
      id: 'temp-' + Date.now(),
      content: newMessage,
      sender_id: user?.id,
      conversationId: selectedConversation.id,
      messageType: messageType,
      created_at: now.toISOString(),
      localTime: now,
      isOptimistic: true
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setMessageType('text');
    
    setTimeout(() => scrollToBottom(), 100);

    try {
      const { data } = await sendMessage(selectedConversation.id, {
        content: optimisticMessage.content,
        messageType: messageType
      });

      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id ? data : msg
      ));

      updateConversationInBackground(selectedConversation.id, data);

    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      console.error('Error sending message:', error);
    }
  }, [newMessage, selectedConversation, user, messageType, scrollToBottom]);

  const updateConversationInBackground = useCallback(async (conversationId, lastMessage) => {
    try {
      const convId = parseInt(conversationId);
      setConversations(prev => {
        const updated = prev.map(conv => {
          const convIdFromList = parseInt(conv.id);
          if (convIdFromList === convId) {
            return {
              ...conv,
              last_message: lastMessage.content,
              last_message_at: lastMessage.created_at || lastMessage.timestamp || new Date().toISOString(),
              unread_count: conv.unread_count + 1
            };
          }
          return conv;
        });
        
        const sorted = updated.sort((a, b) => {
          const dateA = new Date(a.last_message_at || 0);
          const dateB = new Date(b.last_message_at || 0);
          return dateB - dateA;
        });
        
        return sorted;
      });
    } catch (error) {
      console.error('Error updating conversation in background:', error);
    }
  }, []);

  const handleStartConversation = useCallback(async (userId) => {
    try {
      const { data } = await startConversation(userId);
      
      if (!data) {
        console.error('Error starting conversation: No data returned');
        alert('Failed to start conversation');
        return;
      }

      setConversations(prev => [data, ...prev]);
      setSelectedConversation(data);
      setShowNewConversation(false);
      
      fetchMessages(data.id);
      fetchConversations();

    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation');
    }
  }, [fetchMessages, fetchConversations]);

  const handleStartConversationWithFriend = useCallback((friend) => {
    const friendId = friend.id || friend.user_id;
    handleStartConversation(friendId);
  }, [handleStartConversation]);

  const formatTime = useCallback((timestamp, localTime) => {
    try {
      const date = localTime || new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Invalid time';
    }
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) return;

    const fetchData = async () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      fetchTimeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;

        abortControllerRef.current = new AbortController();

        try {
          await Promise.allSettled([
            fetchConversations(),
            fetchFriends()
          ]);
        } catch (error) {
          console.error('Error in initial data fetch:', error);
        }
      }, 100);
    };

    fetchData();

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchConversations, fetchFriends]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  

return (
  <>
    <div className="flex h-screen bg-gray-50">
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Messages</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p className="mb-4">No conversations yet</p>
              <button
                onClick={() => setShowNewConversation(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Start New Conversation
              </button>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation)}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedConversation?.id === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <img
                    className="h-10 w-10 rounded-full"
                    src={conversation.participant_avatar || `https://ui-avatars.com/api/?name=${conversation.participant_name}&background=3B82F6&color=fff`}
                    alt={conversation.participant_name}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {conversation.participant_name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {conversation.last_message || 'No messages yet'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatTime(conversation.last_message_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    className="h-10 w-10 rounded-full"
                    src={selectedConversation.participant_avatar || `https://ui-avatars.com/api/?name=${selectedConversation.participant_name}&background=3B82F6&color=fff`}
                    alt={selectedConversation.participant_name}
                  />
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedConversation.participant_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.isOnline ? 'Active now' : 'Offline'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={refreshMessages}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                  title="Refresh messages"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

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

                return (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_id === user?.id 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-900'
                    }`}>
                      <div className="flex items-start space-x-2">
                        {getMessageTypeIcon(message.message_type) && (
                          <span className="mr-1">{getMessageTypeIcon(message.message_type)}</span>
                        )}
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <p className={`text-xs text-gray-400 mt-1 font-medium ${
                        message.sender_id === user?.id ? 'text-right' : 'text-left'
                      }`}>
                        {formatTime(message.created_at, message.localTime)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18m0 0l9 2-9 18" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 text-lg mb-4">Select a conversation</div>
              <p className="text-gray-500 mb-4">Choose a conversation from the list to start messaging</p>
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
            <p className="text-gray-500 text-center py-4">
              No friends found. Add friends first to start messaging.
            </p>
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
  </>
);
};

export default MessagesPage;