import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { getPosts, createPost, toggleLike, updatePost, deletePost } from '../api';

const DashboardPage = () => {
  const { user } = React.useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await getPosts();
      
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await createPost({
        content: newPost,
        visibility: 'public'
      });
      
      if (error) {
        console.error('Error creating post:', error);
        alert(`Failed to create post: ${error.message || 'Please try again.'}`);
        return;
      }
      
      setPosts([data, ...posts]);
      setNewPost('');
      console.log('Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      alert(`Failed to create post: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const { data, error } = await toggleLike(postId);
      
      if (error) throw error;
      
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, userLiked: data.liked, likes_count: post.likes_count + (data.liked ? 1 : -1) }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.displayName || user?.username}! 👋
        </h1>
        <p className="mt-2 text-gray-600">
          What's on your mind today? Share your thoughts with the community.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Create Post */}
          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleCreatePost}>
              <div className="mb-4">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows="3"
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
                  >
                    📷 Photo
                  </button>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
                  >
                    😊 Feeling
                  </button>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
                  >
                    📍 Location
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!newPost.trim() || isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>

          {/* Posts Feed */}
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-500 text-lg">No posts yet</div>
                <p className="text-gray-400 mt-2">Be the first to share something!</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start space-x-3">
                    <img
                      className="h-10 w-10 rounded-full"
                      src={`https://ui-avatars.com/api/?name=${post.author?.display_name || 'Anonymous'}&background=6366f1&color=fff`}
                      alt={post.author?.display_name || 'Anonymous'}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900">{post.author?.display_name || 'Anonymous'}</h3>
                          <span className="text-gray-500 text-sm">
                            @{post.author?.username || 'anonymous'} · {formatTimeAgo(post.created_at)}
                          </span>
                        </div>
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
                      <div className="mt-2 text-gray-800 whitespace-pre-wrap">
                        {editingPost === post.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                              rows="3"
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSaveEdit(post.id)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
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
                      <div className="mt-4 flex items-center space-x-4">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center space-x-1 ${
                            post.userLiked ? 'text-red-600' : 'text-gray-500'
                          } hover:text-red-600 transition-colors`}
                        >
                          <span>{post.userLiked ? '❤️' : '🤍'}</span>
                          <span className="text-sm">{post.likes_count}</span>
                        </button>
                        <button className="flex items-center space-x-1 text-gray-500 hover:text-blue-600 transition-colors">
                          <span>💬</span>
                          <span className="text-sm">{post.comments_count}</span>
                        </button>
                        <button className="flex items-center space-x-1 text-gray-500 hover:text-green-600 transition-colors">
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
          {/* Profile Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <img
                className="h-20 w-20 rounded-full mx-auto mb-4"
                src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.displayName || user?.username}&background=6366f1&color=fff&size=128`}
                alt={user?.displayName || user?.username}
              />
              <h3 className="font-semibold text-gray-900 text-lg">
                {user?.displayName || user?.username}
              </h3>
              <p className="text-gray-500">@{user?.username}</p>
              <Link
                to={`/profile/${user?.username}`}
                className="mt-4 inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                View Profile
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
            <div className="space-y-2">
              <Link
                to="/communities"
                className="block text-gray-600 hover:text-indigo-600 py-2"
              >
                🏘️ Explore Communities
              </Link>
              <Link
                to="/messages"
                className="block text-gray-600 hover:text-indigo-600 py-2"
              >
                💬 Messages
              </Link>
              <Link
                to="/settings"
                className="block text-gray-600 hover:text-indigo-600 py-2"
              >
                ⚙️ Settings
              </Link>
            </div>
          </div>

          {/* Suggestions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Who to Follow</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      className="h-8 w-8 rounded-full"
                      src={`https://ui-avatars.com/api/?name=User${i}&background=6366f1&color=fff`}
                      alt={`User ${i}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">User {i}</p>
                      <p className="text-xs text-gray-500">@user{i}</p>
                    </div>
                  </div>
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-xs font-medium">
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
