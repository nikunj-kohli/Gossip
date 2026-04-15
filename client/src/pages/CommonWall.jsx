import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from "../contexts/AuthContext";
import { getPosts, createPost, getUserMemberships, getPostById, uploadPostMedia } from '../api';
import { normalizeMediaContent } from '../utils/mediaContent';

const CommonWall = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [postMode, setPostMode] = useState('no-community'); // 'no-community' or 'community'
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [userCommunities, setUserCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [wallFilter, setWallFilter] = useState('mine');

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
    if (!newPost.trim() && mediaFiles.length === 0) {
      alert('Please write something or attach media');
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

      const uploadedMedia = [];
      for (const file of mediaFiles) {
        const { data, error } = await uploadPostMedia(file);
        if (error || !data?.url) {
          alert(error?.response?.data?.message || error?.message || 'Failed to upload media');
          setIsSubmitting(false);
          return;
        }
        uploadedMedia.push(data.url);
      }

      const normalizedContent = [newPost.trim(), ...uploadedMedia].filter(Boolean).join('\n');

      const postPayload = {
        content: normalizedContent,
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
      setIsAnonymous(false);
      setMediaFiles([]);
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

  const isOwnPost = (post) => {
    const currentUserId = user?.id;
    return String(post?.user_id || post?.author?.id || post?.author_id || '') === String(currentUserId || '');
  };

  const visiblePosts = useMemo(() => {
    const rows = Array.isArray(posts) ? posts : [];

    switch (wallFilter) {
      case 'mine':
        return rows.filter((post) => isOwnPost(post));
      case 'anonymous':
        return rows.filter((post) => Boolean(post.is_anonymous));
      case 'community':
        return rows.filter((post) => Boolean(post.group_id || post.group_name || post.group_slug));
      default:
        return rows;
    }
  }, [posts, wallFilter, user]);

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
        <div className="mb-6 rounded-3xl border border-white/70 bg-gradient-to-br from-[#f7f1e8] via-white to-[#eef4ff] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h1 className="text-3xl font-bold text-gray-900">Wall</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Your wall is focused on your account by default. Switch filters if you want to inspect anonymous or community posts.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-[#e5ddd0] bg-white p-3 shadow-sm">
          {[
            { id: 'mine', label: 'Mine' },
            { id: 'anonymous', label: 'Anonymous' },
            { id: 'community', label: 'Communities' },
            { id: 'all', label: 'All' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setWallFilter(filter.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${wallFilter === filter.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        {/* Create Post Section */}
        {user ? (
          <div className="mb-6 overflow-hidden rounded-3xl border border-[#e9e2d6] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <div className="border-b border-[#efe9de] bg-gradient-to-r from-[#fffaf3] to-white px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Create a post</h2>
              <p className="text-sm text-gray-600">Keep it simple. Text is optional, media is optional.</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's on your mind? Add text or attach photos/videos."
                className="min-h-[120px] w-full resize-none rounded-2xl border border-[#d9d1c4] bg-[#fcfbf8] px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />

              <div className="rounded-2xl border border-dashed border-[#d9d1c4] bg-[#faf7f0] px-4 py-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Add media</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setMediaFiles(Array.from(e.target.files || []).slice(0, 4))}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-full file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800"
                />
                {mediaFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mediaFiles.map((file) => (
                      <span key={`${file.name}-${file.size}`} className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 border border-[#e5ddd0]">
                        {file.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    id="anonymousToggle"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Post anonymously
                </label>
                <button
                  onClick={handleCreatePost}
                  disabled={isSubmitting}
                  className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white transition ${
                    isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isSubmitting ? 'Posting...' : 'Publish'}
                </button>
              </div>

              <div className="rounded-2xl border border-[#ebe4d9] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Destination</p>
                    <p className="text-xs text-gray-500">Choose either the global wall or a community.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="postMode"
                        value="no-community"
                        checked={postMode === 'no-community'}
                        onChange={(e) => {
                          setPostMode(e.target.value);
                          setSelectedCommunity(null);
                        }}
                        className="h-4 w-4"
                      />
                      Wall
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="postMode"
                        value="community"
                        checked={postMode === 'community'}
                        onChange={(e) => setPostMode(e.target.value)}
                        className="h-4 w-4"
                      />
                      Community
                    </label>
                  </div>
                </div>

                {postMode === 'community' && (
                  <div className="mt-4">
                    <select
                      value={selectedCommunity?.id || selectedCommunity?.group_id || ''}
                      onChange={(e) => {
                        const communityId = parseInt(e.target.value);
                        const selected = userCommunities.find((c) => (c.id || c.group_id) === communityId);
                        setSelectedCommunity(selected || null);
                      }}
                      className="w-full rounded-xl border border-[#d9d1c4] bg-[#fcfbf8] px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select a Community --</option>
                      {userCommunities.map((community) => (
                        <option key={community.id || community.group_id} value={community.id || community.group_id}>
                          {community.name || community.group_name || 'Unnamed'}
                        </option>
                      ))}
                    </select>
                    {userCommunities.length === 0 && (
                      <p className="mt-2 text-sm text-gray-500">
                        You haven't joined any communities yet. <a href="/communities" className="text-blue-600 hover:underline">Browse communities</a>
                      </p>
                    )}
                  </div>
                )}

                {postMode === 'community' && selectedCommunity && (
                  <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    Posting to {selectedCommunity.name || selectedCommunity.group_name || 'this community'}
                  </div>
                )}
              </div>
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
          {visiblePosts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <p className="text-gray-500">No posts match this filter yet.</p>
            </div>
          ) : (
            visiblePosts.map((post) => {
              const media = normalizeMediaContent(post.content);
              return (
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
                      {media.text}
                    </div>
                    {media.images.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        {media.images.map((url, idx) => (
                          <img key={`${post.id}-img-${idx}`} src={url} alt="Post media" className="w-full rounded-lg border object-cover" />
                        ))}
                      </div>
                    )}
                    {media.videos.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {media.videos.map((url, idx) => (
                          <video key={`${post.id}-vid-${idx}`} src={url} controls className="w-full rounded-lg border" preload="metadata" />
                        ))}
                      </div>
                    )}
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CommonWall;
