import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from "../contexts/AuthContext";
import { getPosts, createPost, getUserMemberships, getPostById } from '../api';

const CommonWall = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [postType, setPostType] = useState('text');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [postMode, setPostMode] = useState('no-community'); // 'no-community' or 'community'
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [userCommunities, setUserCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const fetchUserCommunities = async () => {
    try {
      const { data, error } = await getUserMemberships();
      if (error) {
        console.error('Error fetching user communities:', error);
        setUserCommunities([]);
      } else {
        // Handle both array and object response formats
        const commArray = Array.isArray(data)
          ? data
          : (data?.groups || data?.memberships || []);
        setUserCommunities(Array.isArray(commArray) ? commArray : []);
      }
    } catch (error) {
      console.error('Error fetching user communities:', error);
      setUserCommunities([]);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim()) {
      alert('Please write something in your post');
      return;
    }

    // Validate community selection if in community mode
    if (postMode === 'community' && !selectedCommunity) {
      alert('Please select a community to post to');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if user is authenticated
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to create posts');
        setIsSubmitting(false);
        return;
      }

      const postPayload = {
        content: newPost,
        postType: postType,
        isAnonymous: isAnonymous,
        visibility: 'public'
      };

      // Add groupId if posting to a community
      if (postMode === 'community' && selectedCommunity) {
        postPayload.groupId = selectedCommunity.id || selectedCommunity.group_id;
      }

      const { data, error } = await createPost(postPayload);

      if (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post: ' + (error.message || 'Unknown error'));
        setIsSubmitting(false);
        return;
      }

      // Clear input and refresh posts
      setNewPost('');
      setPostType('text');
      setIsAnonymous(false);
      setPostMode('no-community');
      setSelectedCommunity(null);
      await fetchPosts();
      setIsSubmitting(false);
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post: ' + (error.message || 'Unknown error'));
      setIsSubmitting(false);
    }
  };

  const openPostDetail = async (post) => {
    try {
      if (post?.permalink) {
        navigate(`${post.permalink}#comments`);
        return;
      }

      if (!post?.id) return;
      const { data, error } = await getPostById(post.id);
      if (error || !data?.permalink) {
        alert('Unable to open this post right now.');
        return;
      }

      navigate(`${data.permalink}#comments`);
    } catch (error) {
      console.error('Error opening post detail:', error);
      alert('Unable to open this post right now.');
    }
  };

  useEffect(() => {
    const initializeWall = async () => {
      await fetchPosts();
      if (user) {
        await fetchUserCommunities();
      }
    };

    initializeWall();
    
    // Set up periodic refresh for real-time updates
    const interval = setInterval(() => {
      fetchPosts();
    }, 3000); // Refresh every 3 seconds
    
    return () => clearInterval(interval);
  }, [user]);

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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Wall</h1>
        
        {/* Create Post Section */}
        {user ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create a Post</h2>
            <div className="space-y-4">
              {/* Post Type Selection */}
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

              {/* Post Content */}
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />

              {/* Anonymity Toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="anonymousToggle"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="anonymousToggle" className="text-sm text-gray-600 cursor-pointer">
                  📛 Post Anonymously
                </label>
              </div>

              {/* Community Selection */}
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Post To:</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="postMode"
                      value="no-community"
                      checked={postMode === 'no-community'}
                      onChange={(e) => {
                        setPostMode(e.target.value);
                        setSelectedCommunity(null);
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-600 cursor-pointer">No Community</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="postMode"
                      value="community"
                      checked={postMode === 'community'}
                      onChange={(e) => setPostMode(e.target.value)}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-600 cursor-pointer">Select Community</span>
                  </label>
                </div>
              </div>

              {/* Community Dropdown */}
              {postMode === 'community' && (
                <div>
                  <select
                    value={selectedCommunity?.id || selectedCommunity?.group_id || ''}
                    onChange={(e) => {
                      const communityId = parseInt(e.target.value);
                      const selected = userCommunities.find(c => (c.id || c.group_id) === communityId);
                      setSelectedCommunity(selected || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a Community --</option>
                    {userCommunities.map((community) => (
                      <option key={community.id || community.group_id} value={community.id || community.group_id}>
                        {community.name || community.group_name || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                  {userCommunities.length === 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      You haven't joined any communities yet. <a href="/communities" className="text-blue-600 hover:underline">Browse communities</a>
                    </p>
                  )}
                </div>
              )}

              {/* Community Info */}
              {postMode === 'community' && selectedCommunity && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    📍 <strong>Posting to:</strong> {selectedCommunity.name || selectedCommunity.group_name || 'This Community'}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleCreatePost}
                disabled={isSubmitting}
                className={`w-full py-2 rounded-lg text-white font-medium transition ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="text-center">
              <p className="text-gray-500 mb-4">Please log in to create posts on the Wall.</p>
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
                    src={post.user?.avatar_url || post.author_avatar || `https://ui-avatars.com/api/?name=${post.user?.display_name || post.user?.username || post.author_name}&background=3B82F6&color=fff`}
                    alt={post.user?.display_name || post.user?.username || post.author_name}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2 flex-wrap gap-2">
                      <h3 className="font-medium text-gray-900">
                        {post.author_name || post.user?.display_name || post.user?.username}
                      </h3>
                      {post.is_anonymous && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                          📛 {post.anonymous_label || 'Anonymous'}
                        </span>
                      )}
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
                      {post.group_id && post.group_name && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                          🏘️ {post.group_name}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-800 mb-3">
                      {post.content}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <button className="hover:text-blue-600 transition">
                        👍 {post.likes_count || 0}
                      </button>
                      <button 
                        onClick={() => openPostDetail(post)}
                        className="hover:text-blue-600 transition cursor-pointer"
                      >
                        💬 {post.comments_count || 0}
                      </button>
                      <button className="hover:text-blue-600 transition">
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
