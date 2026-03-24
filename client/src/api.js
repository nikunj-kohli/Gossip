import { supabase } from './lib/supabaseClient'
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

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
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Token might be expired or invalid
      console.error('🚪', error.response.status, '- Token expired or invalid');
      console.log('🧹 Clearing localStorage and redirecting...');
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
export const getPosts = async () => {
  try {
    const token = localStorage.getItem('token');
    console.log('Current auth token:', token ? 'exists' : 'none'); // Debug auth state
    
    const response = await api.get('/posts');
    console.log('Raw API response:', response.data); // Debug raw response
    
    // Handle different response structures
    let postsData = response.data;
    
    // If response has posts property, extract it
    if (response.data && response.data.posts) {
      console.log('Extracting posts from response.data.posts');
      postsData = response.data.posts;
    } else {
      console.log('Using response.data directly');
    }
    
    // Ensure we always return an array
    const postsArray = Array.isArray(postsData) ? postsData : [];
    console.log('Final posts array length:', postsArray.length);
    
    return { data: postsArray, error: null };
  } catch (error) {
    console.error('Error fetching posts:', error);
    return { data: [], error };
  }
};

export const checkFriendshipStatus = async (username) => {
  try {
    console.log('Checking friendship status with:', username);
    const response = await api.get(`/friends/status/${username}`);
    console.log('Friendship status response:', response.data);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error checking friendship status:', error);
    return { data: null, error };
  }
};

export const getUserProfile = async (username) => {
  try {
    console.log('Fetching user profile for username:', username); // Debug log
    const response = await api.get(`/users/${username}`);
    console.log('Profile API response:', response.data); // Debug response
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    console.error('Error response:', error.response?.data); // Debug error response
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

export const createCommunity = async (communityData) => {
  try {
    const response = await api.post('/groups', communityData);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error creating community:', error);
    return { data: null, error };
  }
};

export const joinCommunity = async (communityId) => {
  try {
    const response = await api.post(`/groups/${communityId}/join`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error joining community:', error);
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

export const getCommunityMembers = async (communityId) => {
  try {
    const response = await api.get(`/groups/${communityId}/members`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching community members:', error);
    return { data: null, error };
  }
};

// Friends (using backend API)
export const getFriends = async ({ signal } = {}) => {
  try {
    const response = await api.get('/friends/friends', { signal });
    return { data: response.data, error: null };
  } catch (error) {
    if (error.name === 'CanceledError') {
      console.log('getFriends request canceled');
      throw error;
    }
    console.error('Error fetching friends:', error);
    return { data: [], error };
  }
};

export const getPendingRequests = async () => {
  try {
    const response = await api.get('/friends/requests');
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return { data: null, error };
  }
};

export const getSentRequests = async () => {
  try {
    const response = await api.get('/friends/sent');
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching sent requests:', error);
    return { data: null, error };
  }
};

export const sendFriendRequest = async (friendId) => {
  try {
    // Validate friendId
    if (!friendId || isNaN(parseInt(friendId))) {
      return { data: null, error: { message: 'Invalid user ID' } };
    }
    
    console.log('Sending friend request to user ID:', friendId);
    const response = await api.post(`/friends/users/${friendId}/request`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error sending friend request:', error.response?.data || error.message);
    return { data: null, error: error.response?.data || error };
  }
};

export const acceptFriendRequest = async (userId) => {
  try {
    const response = await api.post(`/friends/users/${userId}/accept`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return { data: null, error };
  }
};

export const declineFriendRequest = async (userId) => {
  try {
    const response = await api.post(`/friends/users/${userId}/decline`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error declining friend request:', error);
    return { data: null, error };
  }
};

export const removeFriend = async (userId) => {
  try {
    const response = await api.post(`/friends/users/${userId}/remove`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error removing friend:', error);
    return { data: null, error };
  }
};

export const getMutualFriends = async (userId) => {
  try {
    const response = await api.get(`/friends/users/${userId}/mutual`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching mutual friends:', error);
    return { data: null, error };
  }
};

// Messages (using backend API)
export const getConversations = async ({ signal } = {}) => {
  try {
    const response = await api.get('/conversations', { signal });
    return { data: response.data, error: null };
  } catch (error) {
    if (error.name === 'CanceledError') {
      console.log('getConversations request canceled');
      throw error;
    }
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

export const getConversation = async (conversationId) => {
  try {
    const response = await api.get(`/conversations/${conversationId}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return { data: null, error };
  }
};

export const getMessages = async (conversationId) => {
  try {
    const response = await api.get(`/conversations/${conversationId}/messages`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { data: null, error };
  }
};

export const sendMessage = async (conversationId, messageData) => {
  try {
    const response = await api.post(`/conversations/${conversationId}/messages`, messageData);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error sending message:', error);
    return { data: null, error };
  }
};

export const startConversation = async (userId) => {
  try {
    const token = localStorage.getItem('token');
    console.log('=== START CONVERSATION DEBUG ===');
    console.log('Token in localStorage:', token ? 'exists' : 'missing');
    console.log('UserId:', userId);
    console.log('Making request to:', `/conversations/users/${userId}`);
    
    const response = await api.post(`/conversations/users/${userId}`);
    console.log('Conversation response:', response.data);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error starting conversation:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    return { data: null, error };
  }
};

export const markMessagesAsRead = async (conversationId) => {
  try {
    const response = await api.put(`/conversations/${conversationId}/read`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return { data: null, error };
  }
};

export const getUnreadCount = async () => {
  try {
    const response = await api.get('/conversations/unread');
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return { data: null, error };
  }
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
    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return { data: null, error };
  }
};

export { api };
