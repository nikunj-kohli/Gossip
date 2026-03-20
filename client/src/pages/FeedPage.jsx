import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { getPosts, toggleLike, updatePost, deletePost, sendFriendRequest } from '../api';

const FeedPage = () => {
  const { user } = React.useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('hot');
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const lastFetchTimeRef = useRef(0);

  // Reddit-like categories
  const categories = [
    { id: 'all', name: 'All', icon: '🌍' },
    { id: 'rants', name: 'Rants', icon: '😤' },
    { id: 'memes', name: 'Memes', icon: '😂' },
    { id: 'tech', name: 'Tech', icon: '💻' },
    { id: 'relationships', name: 'Relationships', icon: '💕' },
    { id: 'work', name: 'Work', icon: '💼' },
    { id: 'school', name: 'School', icon: '🎓' },
    { id: 'random', name: 'Random', icon: '🎲' }
  ];

  const sortOptions = [
    { id: 'hot', name: '🔥 Hot' },
    { id: 'new', name: '🆕 New' },
    { id: 'top', name: '🏆 Top' },
    { id: 'rising', name: '📈 Rising' }
  ];

  useEffect(() => {
    console.log('FeedPage useEffect triggered:', { selectedCategory, sortBy });
    fetchPosts();
  }, [selectedCategory, sortBy]);

  const fetchPosts = async () => {
    // Prevent rapid-fire calls (minimum 2 seconds between calls)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) {
      console.log('Skipping fetch - too soon since last call');
      return;
    }
    
    try {
      lastFetchTimeRef.current = now;
      setLoading(true);
      const { data, error } = await getPosts();
      
      if (error) throw error;
      
      console.log('Raw API response data:', data); // Debug raw data
      console.log('Data type:', typeof data);
      console.log('Is array?:', Array.isArray(data));
      
      // Ensure data is an array before proceeding
      let filteredPosts = Array.isArray(data) ? data : [];
      
      console.log('Fetched posts after array check:', filteredPosts.length); // Debug log
      
      // TODO: Add category filtering when backend supports it
      // For now, don't filter by category since backend doesn't return category field
      
      // Sort posts
      filteredPosts = sortPosts(filteredPosts, sortBy);
      
      console.log('Posts after sorting:', filteredPosts.length); // Debug final count
      
      setPosts(filteredPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setPosts([]); // Always set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const sortPosts = (posts, sortType) => {
    // Ensure posts is an array before sorting
    if (!Array.isArray(posts)) {
      console.warn('sortPosts received non-array:', posts);
      return [];
    }
    
    const sorted = [...posts];
    switch (sortType) {
      case 'hot':
        return sorted.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      case 'new':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'top':
        return sorted.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      case 'rising':
        return sorted.sort((a, b) => {
          const aScore = (a.likes_count || 0) * 0.5 + (a.comments_count || 0) * 0.3;
          const bScore = (b.likes_count || 0) * 0.5 + (b.comments_count || 0) * 0.3;
          return bScore - aScore;
        });
      default:
        return sorted;
    }
  };

  const handleLike = async (postId) => {
    try {
      const { data, error } = await toggleLike(postId);
      
      if (error) {
        console.error('Error toggling like:', error);
        if (error.response?.status === 403) {
          alert('Authentication failed. Please log in again.');
        }
        return;
      }
      
      if (data) {
        setPosts(posts.map(post => 
          post.id === postId 
            ? { ...post, userLiked: data.liked, likes_count: post.likes_count + (data.liked ? 1 : -1) }
            : post
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      if (error.response?.status === 403) {
        alert('Authentication failed. Please log in again.');
      }
    }
  };

  const handleEditPost = (post) => {
    setEditingPost(post.id);
    setEditContent(post.content);
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setEditContent('');
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim()) return;

    try {
      const { data, error } = await updatePost(postId, { content: editContent });
      
      if (error) throw error;
      
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, content: editContent }
          : post
      ));
      
      setEditingPost(null);
      setEditContent('');
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post. Please try again.');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      const { error } = await deletePost(postId);
      
      if (error) throw error;
      
      setPosts(posts.filter(post => post.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  const handleSendFriendRequest = async (username) => {
    try {
      // First, we need to get the user ID from username
      // For now, let's show a simple alert
      alert(`Friend request feature coming soon for ${username}!`);
      
      // TODO: Implement actual friend request
      // const { data, error } = await sendFriendRequest(userId);
      // if (error) {
      //   console.error('Error sending friend request:', error);
      //   alert('Failed to send friend request. Please try again.');
      // } else {
      //   alert('Friend request sent successfully!');
      // }
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request. Please try again.');
    }
  };

  const handleComment = async (postId) => {
    try {
      // For now, let's show a simple alert
      alert('Comment feature coming soon! 📝');
      
      // TODO: Implement comment modal/navigate to post detail
      // Could navigate to `/post/${postId}` or open a modal
    } catch (error) {
      console.error('Error opening comments:', error);
    }
  };

  const handleShare = async (postId) => {
    try {
      // Get the post URL
      const postUrl = `${window.location.origin}/post/${postId}`;
      
      // Try to use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: 'Check out this post on Gossip',
          text: 'Interesting post on Gossip',
          url: postUrl
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(postUrl);
        alert('Post link copied to clipboard! 📋');
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      alert('Failed to share post. Please try again.');
    }
  };

  const isOwnPost = (post) => {
    const currentUserId = user?.id || JSON.parse(localStorage.getItem('user') || '{}')?.id;
    return post.user_id === currentUserId || post.author?.id === currentUserId;
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getCategoryInfo = (categoryId) => {
    return categories.find(cat => cat.id === categoryId) || categories[6]; // default to random
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Category and Sort Controls */}
            <div className="bg-white rounded-lg shadow-sm border p-3 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sortOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Posts Feed */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6 text-center">
              <div className="text-gray-600 text-sm">
                Want to create a post? Visit your <Link to="/profile" className="text-blue-600 hover:text-blue-700 font-medium">profile/wall</Link> to share your thoughts!
              </div>
            </div>
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                  <div className="text-gray-500 text-lg">No posts in this category yet</div>
                  <p className="text-gray-400 mt-2">Be the first to share something!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start space-x-3">
                      <img
                        className="h-10 w-10 rounded-full"
                        src={`https://ui-avatars.com/api/?name=${post.author_name || 'Anonymous'}&background=3B82F6&color=fff`}
                        alt={post.author_name || 'Anonymous'}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <h3 
                              className={`font-semibold text-gray-900 ${!post.is_anonymous && post.author_username ? 'hover:text-blue-600 cursor-pointer' : ''}`}
                              onClick={() => {
                                if (!post.is_anonymous && post.author_username) {
                                  // Navigate to user profile
                                  window.location.href = `/profile/${post.author_username}`;
                                }
                              }}
                            >
                              {post.author_name || 'Anonymous'}
                            </h3>
                            <span className="text-gray-500 text-sm">
                              @{post.author_username || 'anonymous'} · {formatTimeAgo(post.created_at)}
                            </span>
                            {/* TODO: Add category display when backend supports it */}
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Add friend request button for non-anonymous, non-self posts */}
                            {!post.is_anonymous && post.author?.username && !isOwnPost(post) && (
                              <button
                                onClick={() => {
                                  // Send friend request
                                  handleSendFriendRequest(post.author.username);
                                }}
                                className="text-gray-500 hover:text-green-600 transition-colors"
                                title="Send friend request"
                              >
                                👥
                              </button>
                            )}
                            {isOwnPost(post) && (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEditPost(post)}
                                  className="text-gray-500 hover:text-blue-600 transition-colors"
                                  title="Edit post"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="text-gray-500 hover:text-red-600 transition-colors"
                                  title="Delete post"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-gray-800 whitespace-pre-wrap">
                          {editingPost === post.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows="3"
                              />
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleSaveEdit(post.id)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            post.content
                          )}
                        </div>
                        <div className="mt-4 flex items-center space-x-6">
                          <button
                            onClick={() => handleLike(post.id)}
                            className={`flex items-center space-x-1 ${
                              post.userLiked ? 'text-red-600' : 'text-gray-500'
                            } hover:text-red-600 transition-colors`}
                          >
                            <span>{post.userLiked ? '❤️' : '🤍'}</span>
                            <span className="text-sm">{post.likes_count || 0}</span>
                          </button>
                          <button 
                            onClick={() => handleComment(post.id)}
                            className="flex items-center space-x-1 text-gray-500 hover:text-blue-600 transition-colors"
                          >
                            <span>💬</span>
                            <span className="text-sm">{post.comments_count || 0}</span>
                          </button>
                          <button 
                            onClick={() => handleShare(post.id)}
                            className="flex items-center space-x-1 text-gray-500 hover:text-green-600 transition-colors"
                          >
                            <span>🔄</span>
                            <span className="text-sm">Share</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* About Gossip */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">About Gossip</h3>
              <p className="text-sm text-gray-600">
                A place to share your thoughts, rants, and connect with others. Join communities, make friends, and start conversations.
              </p>
            </div>

            {/* Popular Communities */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Popular Communities</h3>
              <div className="space-y-2">
                {categories.slice(1, 5).map(cat => (
                  <Link
                    key={cat.id}
                    to={`/communities/${cat.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span>{cat.icon}</span>
                      <span className="text-sm font-medium">g/{cat.name.toLowerCase()}</span>
                    </div>
                    <span className="text-xs text-gray-500">{Math.floor(Math.random() * 10000)} members</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="space-y-2">
                <Link to="/communities" className="block text-sm text-blue-600 hover:text-blue-700">
                  🏘️ Browse Communities
                </Link>
                <Link to="/friends" className="block text-sm text-blue-600 hover:text-blue-700">
                  👥 Find Friends
                </Link>
                <Link to="/messages" className="block text-sm text-blue-600 hover:text-blue-700">
                  💬 Messages
                </Link>
                <Link to="/profile" className="block text-sm text-blue-600 hover:text-blue-700">
                  👤 Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedPage;
