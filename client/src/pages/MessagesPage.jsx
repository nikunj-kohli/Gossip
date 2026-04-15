import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import io from 'socket.io-client';
import {
  getInboxConversations,
  getInboxMessages,
  sendInboxMessage,
  deleteInboxMessage,
  getConnections,
  startInboxConversation,
  uploadInboxAttachment,
} from '../api';
import { SkeletonBlock, SkeletonCard } from '../components/Skeletons';
import { getMessagePreviewLabel, normalizeMediaContent } from '../utils/mediaContent';

const MessagesPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [connections, setConnections] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const fileInputRef = useRef(null);

  const socketRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesStartRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const normalizeAttachments = useCallback((rawAttachments) => {
    if (!rawAttachments) return [];

    let parsed = rawAttachments;
    if (typeof rawAttachments === 'string') {
      try {
        parsed = JSON.parse(rawAttachments);
      } catch (e) {
        parsed = [];
      }
    }

    if (!Array.isArray(parsed)) {
      if (parsed && typeof parsed === 'object' && parsed.url) {
        parsed = [parsed];
      } else {
        parsed = [];
      }
    }

    return parsed
      .map((a) => {
        const candidateUrl = a?.url || a?.secure_url || a?.publicUrl || a?.downloadUrl || '';
        const fallbackPathUrl = (typeof a?.path === 'string' && /^https?:\/\//i.test(a.path)) ? a.path : '';
        return {
          ...a,
          url: candidateUrl || fallbackPathUrl || '',
        };
      })
      .filter((a) => Boolean(a.url));
  }, []);

  const normalizeMessage = useCallback((msg) => {
    if (!msg) return msg;
    const timestamp = msg.created_at || msg.createdAt || msg.updated_at || new Date().toISOString();
    const parsedDate = new Date(timestamp);
    return {
      ...msg,
      created_at: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
      attachments: normalizeAttachments(msg.attachments),
    };
  }, [normalizeAttachments]);

  const dedupeMessagesById = useCallback((rows) => {
    if (!Array.isArray(rows)) return [];

    const byId = new Map();
    rows.forEach((msg, idx) => {
      if (!msg) return;
      const key = msg.id != null ? String(msg.id) : `tmp-index-${idx}`;

      // Preserve first-seen order while keeping the most recent payload for the same id.
      const normalized = normalizeMessage(msg);

      if (!byId.has(key)) {
        byId.set(key, normalized);
      } else {
        byId.set(key, { ...byId.get(key), ...normalized });
      }
    });

    return Array.from(byId.values());
  }, [normalizeMessage]);

  const fetchConnections = useCallback(async () => {
    const { data, error } = await getConnections();
    if (error) {
      setConnections([]);
      return;
    }
    setConnections(Array.isArray(data) ? data : []);
  }, []);

  const fetchConversationsList = useCallback(async () => {
    const res = await getInboxConversations();
    const rows = Array.isArray(res?.data)
      ? res.data
      : (Array.isArray(res?.data?.conversations) ? res.data.conversations : []);
    setConversations(rows);
  }, []);

  const fetchConversationMessages = useCallback(async (convId, offset = 0) => {
    if (!convId) return;
    const res = await getInboxMessages(convId, { limit: 100, offset });
    const rows = Array.isArray(res?.data) ? res.data : [];
    
    if (offset === 0) {
      // Initial load
      setMessages(dedupeMessagesById(rows));
      setMessageOffset(0);
      setHasMoreMessages(rows.length >= 100);
    } else {
      // Load more (prepend older messages)
      setMessages((prev) => dedupeMessagesById([...rows, ...prev]));
      setHasMoreMessages(rows.length >= 100);
      setIsLoadingMore(false);
    }
  }, [dedupeMessagesById]);

  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchConnections(), fetchConversationsList()]);
    } finally {
      setLoading(false);
    }
  }, [fetchConnections, fetchConversationsList]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    hydrate();
  }, [user, hydrate]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      const ids = conversations.map((c) => c.id).filter(Boolean);
      if (ids.length > 0) {
        socket.emit('join:conversations', ids);
      }
    });

    socket.on('message:received', (incoming) => {
      if (!incoming?.id || !incoming?.conversationId) return;

      setConversations((prev) => {
        const next = [...prev];
        const idx = next.findIndex((c) => parseInt(c.id) === parseInt(incoming.conversationId));
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            last_message: getMessagePreviewLabel(incoming),
            last_message_at: incoming.created_at || new Date().toISOString(),
          };
          return next.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
        }
        return prev;
      });

      if (parseInt(selectedConversationRef.current?.id) === parseInt(incoming.conversationId)) {
        const normalizedIncoming = normalizeMessage({
          ...incoming,
          sender_id: incoming.sender_id || incoming.senderId,
        });

        setMessages((prev) => {
          const incomingAttachmentUrls = (normalizedIncoming.attachments || []).map((a) => a.url).join('|');
          const trimmedIncomingContent = (normalizedIncoming.content || '').trim();

          const withoutMatchingTemp = prev.filter((m) => {
            if (!(typeof m.id === 'string' && m.id.startsWith('tmp-'))) {
              return true;
            }

            const sameSender = parseInt(m.sender_id, 10) === parseInt(normalizedIncoming.sender_id, 10);
            const sameContent = ((m.content || '').trim() === trimmedIncomingContent);
            const tempAttachmentUrls = normalizeAttachments(m.attachments).map((a) => a.url).join('|');
            const sameAttachments = tempAttachmentUrls === incomingAttachmentUrls;

            return !(sameSender && sameContent && sameAttachments);
          });

          const next = [...withoutMatchingTemp, normalizedIncoming];
          return dedupeMessagesById(next);
        });
      }
    });

    socket.on('conversation:update', () => {
      fetchConversationsList();
    });

    socket.on('message:deleted', (payload) => {
      const incomingId = parseInt(payload?.messageId, 10);
      if (!incomingId) return;

      setMessages((prev) => prev.map((m) => {
        if (parseInt(m.id, 10) !== incomingId) return m;
        return {
          ...m,
          content: '[Message deleted]',
          attachments: [],
          messageType: 'text',
          message_type: 'text',
        };
      }));
    });

    socket.on('typing:update', (payload) => {
      if (!payload?.channelId) return;
      if (parseInt(payload.channelId, 10) !== parseInt(selectedConversationRef.current?.id, 10)) return;
      const users = Array.isArray(payload.users) ? payload.users : [];
      const filtered = users.filter((u) => parseInt(u.id, 10) !== parseInt(user.id, 10));
      setTypingUsers(filtered);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, fetchConversationsList, dedupeMessagesById]);

  useEffect(() => {
    if (!socketRef.current) return;
    const ids = conversations.map((c) => c.id).filter(Boolean);
    if (ids.length > 0) {
      socketRef.current.emit('join:conversations', ids);
    }
  }, [conversations]);

  useEffect(() => {
    if (!conversationId || !user) return;
    if (loading) return;

    const parsed = parseInt(conversationId, 10);
    if (Number.isNaN(parsed)) return;

    const existingConversation = conversations.find((c) => parseInt(c.id, 10) === parsed);
    if (existingConversation) {
      setSelectedConversation(existingConversation);
      setMessageOffset(0);
      setHasMoreMessages(true);
      fetchConversationMessages(existingConversation.id, 0);
      navigate('/inbox', { replace: true });
      return;
    }

    const isAllowedConnection = connections.some((c) => {
      const id = c.user_id || c.id;
      return parseInt(id, 10) === parsed;
    });

    if (!isAllowedConnection) {
      alert('Request must be accepted before messaging this user.');
      navigate('/requests', { replace: true });
      return;
    }

    startInboxConversation(parsed)
      .then(({ data, error }) => {
        if (error || !data) {
          alert(error?.response?.data?.message || 'Cannot start conversation');
          navigate('/requests', { replace: true });
          return;
        }

        const convId = data.conversationId || data.id;
        const normalized = { ...data, id: convId };

        setConversations((prev) => {
          if (prev.some((c) => parseInt(c.id, 10) === parseInt(convId, 10))) {
            return prev;
          }
          return [normalized, ...prev];
        });
        setSelectedConversation(normalized);
        setMessageOffset(0);
        setHasMoreMessages(true);
        fetchConversationMessages(convId, 0);
        navigate('/inbox', { replace: true });
      })
      .catch((err) => {
        alert(err?.response?.data?.message || 'Cannot start conversation');
        navigate('/requests', { replace: true });
      });
  }, [conversationId, user, loading, connections, conversations, navigate, fetchConversationMessages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (socketRef.current && selectedConversationRef.current?.id) {
        socketRef.current.emit('typing:stop', {
          channelType: 'conversation',
          channelId: selectedConversationRef.current.id,
        });
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSend = async () => {
    if (isSending) return;
    if (!selectedConversation || (!newMessage.trim() && attachmentFiles.length === 0)) return;

    const trimmedContent = newMessage.trim();

    setIsSending(true);

    const uploadedAttachments = [];
    for (const file of attachmentFiles) {
      const uploadResult = await uploadInboxAttachment(file, user?.id);
      if (uploadResult.error || !uploadResult.data) {
        alert(uploadResult.error?.message || 'Attachment upload failed');
        setIsSending(false);
        return;
      }
      uploadedAttachments.push(uploadResult.data);
    }

    const optimistic = normalizeMessage({
      id: `tmp-${Date.now()}`,
      conversationId: selectedConversation.id,
      sender_id: user.id,
      content: trimmedContent,
      attachments: uploadedAttachments,
      created_at: new Date().toISOString(),
    });

    setMessages((prev) => dedupeMessagesById([...prev, optimistic]));
    setNewMessage('');

    const { data, error } = await sendInboxMessage(selectedConversation.id, {
      content: trimmedContent,
      messageType: uploadedAttachments.length > 0 ? 'media' : 'text',
      attachments: uploadedAttachments,
    });

    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      alert(error?.response?.data?.message || 'Failed to send message');
      setIsSending(false);
      return;
    }

    setMessages((prev) => {
      const replaced = prev.map((m) => (m.id === optimistic.id ? data : m));
      return dedupeMessagesById(replaced);
    });
    setAttachmentFiles([]);

    if (socketRef.current && selectedConversation?.id) {
      socketRef.current.emit('typing:stop', {
        channelType: 'conversation',
        channelId: selectedConversation.id,
      });
    }

    setIsSending(false);
  };

  const onDeleteMessage = async (messageId) => {
    if (!messageId) return;
    const confirmed = window.confirm('Delete this message for everyone? This also removes uploaded media from cloud storage.');
    if (!confirmed) return;

    const { error } = await deleteInboxMessage(messageId);
    if (error) {
      alert(error?.response?.data?.message || 'Failed to delete message');
      return;
    }

    setMessages((prev) => prev.map((m) => {
      if (parseInt(m.id, 10) !== parseInt(messageId, 10)) return m;
      return {
        ...m,
        content: '[Message deleted]',
        attachments: [],
        messageType: 'text',
        message_type: 'text',
      };
    }));
  };

  const handleTyping = (value) => {
    setNewMessage(value);
    if (!socketRef.current || !selectedConversation?.id) return;

    socketRef.current.emit('typing:start', {
      channelType: 'conversation',
      channelId: selectedConversation.id,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && selectedConversation?.id) {
        socketRef.current.emit('typing:stop', {
          channelType: 'conversation',
          channelId: selectedConversation.id,
        });
      }
    }, 1200);
  };

  const handleMessagesScroll = (e) => {
    const container = e.target;
    if (container.scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
      setIsLoadingMore(true);
      const newOffset = messageOffset + 100;
      setMessageOffset(newOffset);
      fetchConversationMessages(selectedConversation.id, newOffset);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-[calc(100vh-4rem)]">
          <aside className="w-80 bg-white border-r border-gray-200 p-4 space-y-4">
            <SkeletonBlock className="h-7 w-24" />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </aside>
          <section className="flex-1 p-4 space-y-4">
            <SkeletonBlock className="h-8 w-48" />
            <SkeletonCard lines={3} media />
            <SkeletonCard lines={2} media />
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <SkeletonBlock className="h-11 w-full rounded-full" />
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Messages</h2>
            <button onClick={() => setShowStartModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm">Start</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No conversations yet</div>
            ) : (
              conversations.map((conversation) => {
                const participant = conversation.participants?.[0];
                const displayName = participant?.display_name || participant?.username || 'Unknown';
                const previewText = conversation.last_message || 'No messages yet';
                const participantAvatar = participant?.avatar_url
                  || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3B82F6&color=fff`;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => {
                      setSelectedConversation(conversation);
                      fetchConversationMessages(conversation.id);
                    }}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${parseInt(selectedConversation?.id, 10) === parseInt(conversation.id, 10) ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={participantAvatar}
                        alt={displayName}
                        className="h-10 w-10 rounded-full border border-gray-200 object-cover"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{displayName}</div>
                        <div className="text-sm text-gray-500 truncate">{previewText}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex-1 flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">Choose a conversation to start messaging</div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedConversation.participants?.[0]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConversation.participants?.[0]?.display_name || selectedConversation.participants?.[0]?.username || 'Conversation')}&background=3B82F6&color=fff`}
                    alt={selectedConversation.participants?.[0]?.display_name || selectedConversation.participants?.[0]?.username || 'Conversation'}
                    className="h-10 w-10 rounded-full border border-gray-200 object-cover"
                    loading="lazy"
                  />
                  <h3 className="font-medium text-gray-900">
                    {selectedConversation.participants?.[0]?.display_name || selectedConversation.participants?.[0]?.username || 'Conversation'}
                  </h3>
                </div>
              </div>

              <div 
                className="flex-1 overflow-y-auto p-4 space-y-3"
                onScroll={handleMessagesScroll}
              >
                {isLoadingMore && <div className="text-center text-xs text-gray-400 py-2">Loading older messages...</div>}
                <div ref={messagesStartRef} />
                {messages.map((m) => {
                  const mine = parseInt(m.sender_id, 10) === parseInt(user?.id, 10);
                  const media = normalizeMediaContent(m.content);
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`${mine ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} max-w-lg px-4 py-2 rounded-lg`}>
                        {mine && !String(m.id).startsWith('tmp-') && m.content !== '[Message deleted]' && (
                          <div className="text-right mb-1">
                            <button
                              onClick={() => onDeleteMessage(m.id)}
                              className={`text-[10px] underline ${mine ? 'text-blue-100' : 'text-gray-600'}`}
                            >
                              Delete for everyone
                            </button>
                          </div>
                        )}
                        {m.content !== '[Message deleted]' && (
                          <div className="space-y-2">
                            {media.text && <p className="text-sm whitespace-pre-wrap">{media.text}</p>}
                            {media.images.length > 0 && (
                              <div className="space-y-2">
                                {media.images.map((url, idx) => (
                                  <img
                                    key={`${m.id}-media-img-${idx}`}
                                    src={url}
                                    alt={m.attachments?.[idx]?.name || 'attachment'}
                                    className="max-w-xs max-h-52 rounded-md border border-black/10"
                                    loading="lazy"
                                  />
                                ))}
                              </div>
                            )}
                            {media.videos.length > 0 && (
                              <div className="space-y-2">
                                {media.videos.map((url, idx) => (
                                  <video
                                    key={`${m.id}-media-vid-${idx}`}
                                    src={url}
                                    controls
                                    className="max-w-xs rounded-md border border-black/10"
                                    preload="metadata"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {m.content === '[Message deleted]' && (
                          <p className="text-sm italic opacity-80">Message deleted</p>
                        )}
                        {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {m.attachments.map((a, idx) => (
                              <div key={`${m.id}-a-${idx}`} className="space-y-1">
                                {(() => {
                                  const mimeType = (a.mimeType || a.type || '').toLowerCase();
                                  const isImage = mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(a.url || '');
                                  if (!isImage) return null;
                                  return (
                                    <img
                                      src={a.url}
                                      alt={a.name || 'attachment'}
                                      className="max-w-xs max-h-52 rounded-md border border-black/10"
                                      loading="lazy"
                                    />
                                  );
                                })()}
                                <a
                                  href={a.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`block text-xs underline ${mine ? 'text-blue-100' : 'text-blue-700'}`}
                                >
                                  {a.name || 'Attachment'}
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className={`text-xs mt-1 ${mine ? 'text-blue-100' : 'text-gray-500'}`}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-gray-200 bg-white flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSend();
                  }}
                  placeholder="Type your message"
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,application/pdf"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).slice(0, 4);
                    setAttachmentFiles(files);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Add media
                </button>
                <button
                  onClick={onSend}
                  disabled={isSending}
                  className={`px-4 py-2 rounded-full text-white ${isSending ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
              {attachmentFiles.length > 0 && (
                <div className="px-4 pb-3 text-xs text-gray-500 flex flex-wrap gap-2">
                  <span>{attachmentFiles.length} attachment(s) selected</span>
                  {attachmentFiles.map((file) => (
                    <span key={`${file.name}-${file.size}`} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
              {typingUsers.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">Someone is typing...</p>
              )}
            </>
          )}
        </section>
      </div>

      {showStartModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-lg p-5 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">Start conversation</h4>
              <button onClick={() => setShowStartModal(false)} className="text-gray-500">Close</button>
            </div>

            {connections.length === 0 ? (
              <div className="text-sm text-gray-600">
                No accepted requests yet.
                <button
                  onClick={() => {
                    setShowStartModal(false);
                    navigate('/requests');
                  }}
                  className="ml-2 text-blue-600 hover:text-blue-700"
                >
                  Go to Request Center
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {connections.map((c) => {
                  const id = c.user_id || c.id;
                  const name = c.display_name || c.username || 'Unknown';
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setShowStartModal(false);
                        navigate(`/inbox/${id}`);
                      }}
                      className="w-full text-left border rounded-md p-3 hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{name}</div>
                      <div className="text-xs text-gray-500">@{c.username || 'unknown'}</div>
                    </button>
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
