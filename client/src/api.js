import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const isRequestAborted = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'ERR_CANCELED'
    || error?.name === 'CanceledError'
    || message.includes('aborted')
    || message.includes('canceled');
};

// Create axios instance with auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle 401 and 403 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token might be expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Posts (using backend API)
export const getPosts = async ({ mode = 'hybrid', limit = 20, offset = 0 } = {}) => {
  try {
    const response = await api.get('/posts', {
      params: { mode, limit, offset },
    });
    
    // Handle different response structures
    let postsData = response.data;
    
    // If response has posts property, extract it
    if (response.data && response.data.posts) {
      postsData = response.data.posts;
    }
    
    // Ensure we always return an array
    const postsArray = Array.isArray(postsData) ? postsData : [];
    
    return { data: postsArray, error: null };
  } catch (error) {
    console.error('Error fetching posts:', error);
    return { data: [], error };
  }
};

export const getDiscoverPosts = async ({ limit = 20, offset = 0 } = {}) => {
  try {
    const response = await api.get('/posts/discover', {
      params: { limit, offset },
    });

    const rows = Array.isArray(response?.data?.posts) ? response.data.posts : [];
    return { data: rows, error: null };
  } catch (error) {
    console.error('Error fetching discover posts:', error);
    return { data: [], error };
  }
};

export const getFeedPreferences = async () => {
  try {
    const response = await api.get('/posts/preferences/feed');
    return { data: response.data?.preferences || null, error: null };
  } catch (error) {
    console.error('Error fetching feed preferences:', error);
    return { data: null, error };
  }
};

export const updateFeedPreferences = async (preferences) => {
  try {
    const response = await api.put('/posts/preferences/feed', preferences);
    return { data: response.data?.preferences || null, error: null };
  } catch (error) {
    console.error('Error updating feed preferences:', error);
    return { data: null, error };
  }
};

export const markPostNotInterested = async (postId) => {
  try {
    const response = await api.post(`/posts/${postId}/not-interested`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error marking post as not interested:', error);
    return { data: null, error };
  }
};

export const checkMessagingAccessStatus = async (username) => {
  try {
    const response = await api.get(`/requests/status/${username}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error checking messaging access status:', error);
    return { data: null, error };
  }
};

export const getUserProfile = async (username) => {
  try {
    const response = await api.get(`/users/${username}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { data: null, error };
  }
};

export const updateMyProfile = async (payload) => {
  try {
    const response = await api.put('/auth/profile', payload);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { data: null, error };
  }
};

export const createPost = async (postData) => {
  try {
    const response = await api.post('/posts', postData);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error creating post:', error);
    return { data: null, error };
  }
};

export const updatePost = async (id, updates) => {
  try {
    const response = await api.put(`/posts/${id}`, updates);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error updating post:', error);
    return { data: null, error };
  }
};

export const deletePost = async (id) => {
  try {
    const response = await api.delete(`/posts/${id}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error deleting post:', error);
    return { data: null, error };
  }
};

export const toggleLike = async (postId) => {
  try {
    const response = await api.post(`/posts/${postId}/like`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error toggling like:', error);
    return { data: null, error };
  }
};

export const sharePost = async (postId) => {
  try {
    const response = await api.post(`/posts/${postId}/share`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error sharing post:', error);
    return { data: null, error };
  }
};

export const getPostComments = async (postId, { limit = 20, offset = 0 } = {}) => {
  try {
    const response = await api.get(`/posts/${postId}/comments`, {
      params: { limit, offset },
    });
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching post comments:', error);
    return { data: null, error };
  }
};

export const addPostComment = async (postId, payload) => {
  try {
    const response = await api.post(`/posts/${postId}/comments`, payload);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error adding post comment:', error);
    return { data: null, error };
  }
};

export const toggleCommentLike = async (postId, commentId) => {
  try {
    const response = await api.post(`/posts/${postId}/comments/${commentId}/like`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error toggling comment like:', error);
    return { data: null, error };
  }
};

export const getPostByPermalink = async ({ communitySlug, headline, dateAndToken }) => {
  try {
    const path = communitySlug
      ? `/posts/c/${communitySlug}/${headline}/${dateAndToken}`
      : `/posts/p/${headline}/${dateAndToken}`;
    const response = await api.get(path);
    return { data: response.data?.post || null, error: null };
  } catch (error) {
    console.error('Error fetching post by permalink:', error);
    return { data: null, error };
  }
};

export const getPostById = async (postId) => {
  try {
    const response = await api.get(`/posts/${postId}`);
    return { data: response.data?.post || null, error: null };
  } catch (error) {
    console.error('Error fetching post by id:', error);
    return { data: null, error };
  }
};

// Communities/Groups (using backend API)
export const getCommunities = async () => {
  try {
    const response = await api.get('/groups');
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching communities:', error);
    return { data: null, error };
  }
};

export const getCommunityById = async (communityId) => {
  try {
    const response = await api.get(`/groups/${communityId}`);
    return { data: response.data, error: null };
  } catch (error) {
    if (!isRequestAborted(error)) {
      console.error('Error fetching community:', error);
    }
    return { data: null, error };
  }
};

export const getCommunityByName = async (communityName) => {
  try {
    const response = await api.get(`/groups/name/${communityName}`);
    return { data: response.data, error: null };
  } catch (error) {
    if (!isRequestAborted(error)) {
      console.error('Error fetching community by name:', error);
    }
    return { data: null, error };
  }
};

export const createCommunity = async (communityData) => {
  try {
    const response = await api.post('/groups', communityData);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error creating community:', error);
    return { data: null, error };
  }
};

export const updateGroup = async (communityId, communityData) => {
  try {
    const response = await api.put(`/groups/${communityId}`, communityData);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error updating community:', error);
    return { data: null, error };
  }
};

export const joinCommunity = async (communityId) => {
  try {
    const response = await api.post(`/groups/${communityId}/join`);
    return { data: response.data, error: null };
  } catch (error) {
    const isAlreadyMemberError = error.response?.status === 400
      && /already a member/i.test(error.response?.data?.message || '');

    if (!isAlreadyMemberError) {
      console.error('Error joining community:', error);
    }

    return { data: null, error };
  }
};

export const leaveCommunity = async (communityId) => {
  try {
    const response = await api.post(`/groups/${communityId}/leave`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error leaving community:', error);
    return { data: null, error };
  }
};

export const deleteGroup = async (communityId) => {
  try {
    const response = await api.delete(`/groups/${communityId}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error deleting community:', error);
    return { data: null, error };
  }
};

export const getCommunityMembers = async (communityId) => {
  try {
    const response = await api.get(`/groups/${communityId}/members`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching community members:', error);
    return { data: null, error };
  }
};

export const getUserMemberships = async () => {
  try {
    const response = await api.get('/groups/user/member');
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching user memberships:', error);
    return { data: null, error };
  }
};

export const getGroupPosts = async (groupId, { limit = 20, offset = 0 } = {}) => {
  try {
    const response = await api.get(`/posts/groups/${groupId}/posts`, {
      params: { limit, offset },
    });
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching group posts:', error);
    return { data: null, error };
  }
};

export const createGroupPost = async (groupId, postData) => {
  try {
    const response = await api.post(`/posts/groups/${groupId}/posts`, postData);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error creating group post:', error);
    return { data: null, error };
  }
};

export const warnCommunityPost = async (postId, reason) => {
  try {
    const response = await api.post(`/posts/${postId}/warn`, { reason });
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error warning community post:', error);
    return { data: null, error };
  }
};

// Requests and connections (backend API)
export const getConnections = async ({ signal } = {}) => {
  try {
    const response = await api.get('/requests/connections', { signal });
    return { data: response.data, error: null };
  } catch (error) {
    if (error.name === 'CanceledError') {
      console.log('getConnections request canceled');
      throw error;
    }
    console.error('Error fetching connections:', error);
    return { data: [], error };
  }
};

export const getIncomingMessageRequests = async () => {
  try {
    const response = await api.get('/requests/incoming');
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching incoming requests:', error);
    return { data: null, error };
  }
};

export const getOutgoingMessageRequests = async () => {
  try {
    const response = await api.get('/requests/outgoing');
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching outgoing requests:', error);
    return { data: null, error };
  }
};

export const sendMessageRequest = async (userId) => {
  try {
    if (!userId || isNaN(parseInt(userId, 10))) {
      return { data: null, error: { message: 'Invalid user ID' } };
    }

    const response = await api.post(`/requests/users/${userId}/request`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error sending message request:', error.response?.data || error.message);
    return { data: null, error: error.response?.data || error };
  }
};

export const acceptMessageRequest = async (userId) => {
  try {
    const response = await api.post(`/requests/users/${userId}/accept`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error accepting message request:', error);
    return { data: null, error };
  }
};

export const declineMessageRequest = async (userId) => {
  try {
    const response = await api.post(`/requests/users/${userId}/decline`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error declining message request:', error);
    return { data: null, error };
  }
};

export const cancelMessageRequest = async (userId) => {
  try {
    const response = await api.post(`/requests/users/${userId}/cancel`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error cancelling message request:', error);
    return { data: null, error };
  }
};

export const removeConnection = async (userId) => {
  try {
    const response = await api.post(`/requests/users/${userId}/remove`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error removing connection:', error);
    return { data: null, error };
  }
};

export const getMutualFriends = async (userId) => {
  try {
    const response = await api.get(`/requests/users/${userId}/mutual`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching mutual friends:', error);
    return { data: null, error };
  }
};

// Inbox (using backend API)
export const getInboxConversations = async ({ signal } = {}) => {
  try {
    const response = await api.get('/inbox', { signal });
    return { data: response.data, error: null };
  } catch (error) {
    if (error.name === 'CanceledError') {
      console.log('getInboxConversations request canceled');
      throw error;
    }
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

export const getInboxConversation = async (conversationId) => {
  try {
    const response = await api.get(`/inbox/${conversationId}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return { data: null, error };
  }
};

export const getInboxMessages = async (conversationId, { limit = 100, offset = 0 } = {}) => {
  try {
    const response = await api.get(`/inbox/${conversationId}/messages`, {
      params: { limit, offset },
    });
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { data: null, error };
  }
};

export const sendInboxMessage = async (conversationId, messageData) => {
  try {
    const response = await api.post(`/inbox/${conversationId}/messages`, messageData);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error sending message:', error);
    return { data: null, error };
  }
};

export const startInboxConversation = async (userId) => {
  try {
    const response = await api.post(`/inbox/users/${userId}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error starting conversation:', error);
    return { data: null, error };
  }
};

export const markInboxMessagesAsRead = async (conversationId) => {
  try {
    const response = await api.put(`/inbox/${conversationId}/read`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return { data: null, error };
  }
};

export const deleteInboxMessage = async (messageId) => {
  try {
    const response = await api.delete(`/inbox/messages/${messageId}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error deleting inbox message:', error);
    return { data: null, error };
  }
};

export const getInboxUnreadCount = async () => {
  try {
    const response = await api.get('/inbox/unread');
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return { data: null, error };
  }
};

export const uploadInboxAttachment = async (file, userId) => {
  try {
    const formData = new FormData();
    formData.append('media', file);
    formData.append('type', file.type && file.type.startsWith('video/') ? 'video' : 'image');

    const response = await api.post('/media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const media = response?.data?.media || response?.data?.data || response?.data || {};
    const resolvedUrl = media.url || media.secure_url || media?.variants?.original || '';

    if (!resolvedUrl || !/^https?:\/\//i.test(resolvedUrl)) {
      return {
        data: null,
        error: new Error('Upload succeeded but no valid public file URL was returned.'),
      };
    }

    return {
      data: {
        url: resolvedUrl,
        path: media.public_id || media.publicId || resolvedUrl,
        name: file.name,
        size: media.size || file.size,
        mimeType: media.metadata?.mimeType || file.type || 'application/octet-stream',
      },
      error: null,
    };
  } catch (error) {
    console.error('Error uploading inbox attachment:', error);
    return { data: null, error };
  }
};

export const uploadPostMedia = async (file) => {
  return uploadInboxAttachment(file);
};

// Search users
export const searchUsers = async (query) => {
  try {
    const response = await api.get(`/search/users?q=${encodeURIComponent(query)}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error searching users:', error);
    return { data: null, error };
  }
};

// Get user's posts
export const getUserPosts = async (userId) => {
  try {
    const response = await api.get(`/posts/user/${userId}`);
    const rows = Array.isArray(response?.data)
      ? response.data
      : (Array.isArray(response?.data?.posts) ? response.data.posts : []);
    return { data: rows, error: null };
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return { data: null, error };
  }
};

export { api };
