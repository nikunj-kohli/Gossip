import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from "../contexts/AuthContext";
import { getPosts, createPost } from '../api';

const CommonWall = () => {
  const { user } = useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [postType, setPostType] = useState('text');
  const [loading, setLoading] = useState(true);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) {
      return 'just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await getPosts();
      
      if (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;

    try {
      // Check if user is authenticated
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to create posts');
        return;
      }

      const { data, error } = await createPost({
        content: newPost,
        postType: postType,
        isAnonymous: false
      });

      if (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post: ' + (error.message || 'Unknown error'));
        return;
      }

      // Clear input and refresh posts
      setNewPost('');
      setPostType('text');
      await fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post: ' + (error.message || 'Unknown error'));
    }
  };

  useEffect(() => {
    fetchPosts();
    
    // Set up periodic refresh for real-time updates
    const interval = setInterval(() => {
      fetchPosts();
    }, 3000); // Refresh every 3 seconds
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Common Wall</h1>
        
        {/* Create Post Section */}
        {user ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create a Post</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Type:</label>
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">📝 Text</option>
                  <option value="media">📷 Media</option>
                  <option value="poll">📊 Poll</option>
                  <option value="link">🔗 Link</option>
                </select>
              </div>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <button
                onClick={handleCreatePost}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Post
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="text-center">
              <p className="text-gray-500 mb-4">Please log in to create posts on the Common Wall.</p>
              <button
                onClick={() => window.location.href = '/login'}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Log In
              </button>
            </div>
          </div>
        )}

        {/* Posts Feed */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <p className="text-gray-500">No posts yet. Be the first to share something!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start space-x-3">
                  <img
                    className="h-10 w-10 rounded-full"
                    src={post.user?.avatar_url || `https://ui-avatars.com/api/?name=${post.user?.display_name || post.user?.username}&background=3B82F6&color=fff`}
                    alt={post.user?.display_name || post.user?.username}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-medium text-gray-900">
                        {post.user?.display_name || post.user?.username}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(post.created_at)}
                      </span>
                      {post.post_type && post.post_type !== 'text' && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                          {post.post_type === 'media' ? '📷 Media' : 
                           post.post_type === 'poll' ? '📊 Poll' : 
                           post.post_type === 'link' ? '🔗 Link' : 
                           post.post_type}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-800 mb-3">
                      {post.content}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <button className="hover:text-blue-600">
                        👍 {post.likes_count || 0}
                      </button>
                      <button className="hover:text-blue-600">
                        💬 {post.comments_count || 0}
                      </button>
                      <button className="hover:text-blue-600">
                        🔄 {post.shares_count || 0}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommonWall;
