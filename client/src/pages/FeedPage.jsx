import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { getPosts, getDiscoverPosts, getCommunities, getPostById, sharePost, toggleLike, updatePost, deletePost, sendMessageRequest } from '../api';
import { SkeletonBlock, SkeletonCard } from '../components/Skeletons';

const FeedPage = () => {
  const { user } = React.useContext(AuthContext);
  const navigate = useNavigate();
  const profilePath = user?.username ? `/profile/${user.username}` : '/profile';
  const [posts, setPosts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedMode, setFeedMode] = useState('hybrid');
  const [sortBy, setSortBy] = useState('new');
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const lastFetchTimeRef = useRef(0);

  const sortOptions = [
    { id: 'new', name: '🆕 New' },
    { id: 'old', name: '🕰️ Old' },
    { id: 'top', name: '🏆 Top' },
  ];

  const feedLabels = {
    hybrid: 'Hybrid',
    pulse: 'General',
    tribes: 'Communities',
    discover: 'Discover',
  };

  const feedDescriptions = {
    hybrid: 'Balanced mix of general posts and community activity',
    pulse: 'Broad general feed from across Gossip',
    tribes: 'Community-first posts from your circles',
    discover: 'Fresh posts you have not explored yet',
  };

  useEffect(() => {
    fetchPosts();
  }, [feedMode, sortBy]);

  useEffect(() => {
    const fetchCommunities = async () => {
      const { data, error } = await getCommunities();
      if (error) {
        setCommunities([]);
        return;
      }

      const rows = Array.isArray(data)
        ? data
        : (Array.isArray(data?.groups) ? data.groups : []);

      setCommunities(rows);
    };

    fetchCommunities();
  }, []);

  const fetchPosts = async () => {
    // Prevent rapid-fire calls (minimum 2 seconds between calls)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) {
      return;
    }
    
    try {
      lastFetchTimeRef.current = now;
      setLoading(true);
      const response = feedMode === 'discover'
        ? await getDiscoverPosts({ limit: 20, offset: 0 })
        : await getPosts({ mode: feedMode, limit: 20, offset: 0 });

      const { data, error } = response;
      
      if (error) throw error;
      
      // Ensure data is an array before proceeding
      let filteredPosts = Array.isArray(data) ? data : [];
      
      // TODO: Add category filtering when backend supports it
      // For now, don't filter by category since backend doesn't return category field
      
      filteredPosts = sortPosts(filteredPosts, sortBy);
      
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
      case 'new':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'old':
        return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      case 'top':
        return sorted.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
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

  const handleSendMessageRequest = async (userId) => {
    try {
      if (!userId) {
        alert('User not available for request');
        return;
      }

      const { error } = await sendMessageRequest(userId);
      if (error) {
        alert(error.response?.data?.message || 'Failed to send request');
        return;
      }

      alert('Message request sent');
    } catch (error) {
      console.error('Error sending message request:', error);
      alert('Failed to send request. Please try again.');
    }
  };

  const extractMediaFromContent = (content = '') => {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = String(content).match(urlRegex) || [];
    const imageRegex = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i;
    const videoRegex = /\.(mp4|mov|webm|mkv|avi)(\?.*)?$/i;

    const images = urls.filter((url) => imageRegex.test(url) || /\/image\/upload\//i.test(url));
    const videos = urls.filter((url) => videoRegex.test(url) || /\/video\/upload\//i.test(url));
    const nonMediaUrls = new Set([...images, ...videos]);
    const text = String(content)
      .replace(urlRegex, (url) => (nonMediaUrls.has(url) ? '' : url))
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { text, images, videos };
  };

  const slugifyText = (text = 'post') =>
    String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'post';

  const formatDateToken = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}${mm}${yyyy}`;
  };

  const encodePostToken = (postId, createdAt) => {
    const ts = new Date(createdAt).getTime();
    if (!postId || Number.isNaN(ts)) return null;
    return btoa(`${postId}:${ts}`)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  };

  const buildPermalinkFromPost = (post) => {
    if (!post?.id || !post?.created_at) return null;
    const headline = slugifyText(post.content || 'post');
    const dateToken = formatDateToken(post.created_at);
    const token = encodePostToken(post.id, post.created_at);
    if (!dateToken || !token) return null;

    if (post.group_slug || post.group_name || post.group_id) {
      const communitySegment = post.group_slug || slugifyText(post.group_name || 'community') || String(post.group_id);
      return `/c/${communitySegment}/${headline}/${dateToken}-${token}`;
    }

    return `/p/${headline}/${dateToken}-${token}`;
  };

  const handleComment = async (post) => {
    try {
      if (post?.permalink) {
        navigate(`${post.permalink}#comments`);
        return;
      }

      const localPermalink = buildPermalinkFromPost(post);
      if (localPermalink) {
        navigate(`${localPermalink}#comments`);
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

  const handleShare = async (postId) => {
    try {
      const { data, error } = await sharePost(postId);
      if (error || !data?.permalink) {
        alert(error?.response?.data?.message || 'Failed to share post.');
        return;
      }

      const postUrl = `${window.location.origin}${data.permalink}`;
      
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

  const suggestedCommunities = [...communities]
    .sort((a, b) => {
      const aCount = Number(a?.member_count ?? a?.members_count ?? a?.members ?? 0);
      const bCount = Number(b?.member_count ?? b?.members_count ?? b?.members ?? 0);
      return bCount - aCount;
    })
    .slice(0, 6);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
                <SkeletonBlock className="h-8 w-72" />
                <div className="flex gap-2">
                  <SkeletonBlock className="h-8 w-20 rounded-full" />
                  <SkeletonBlock className="h-8 w-24 rounded-full" />
                  <SkeletonBlock className="h-8 w-28 rounded-full" />
                  <SkeletonBlock className="h-8 w-24 rounded-full" />
                </div>
              </div>
              <SkeletonCard avatar media lines={3} footer />
              <SkeletonCard avatar media lines={4} footer />
            </div>
            <div className="space-y-4">
              <SkeletonCard lines={3} />
              <SkeletonCard lines={2} />
              <SkeletonCard lines={3} />
            </div>
          </div>
        </div>
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
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setFeedMode('hybrid')}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${feedMode === 'hybrid' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Hybrid
                </button>
                <button
                  onClick={() => setFeedMode('pulse')}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${feedMode === 'pulse' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  General
                </button>
                <button
                  onClick={() => setFeedMode('tribes')}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${feedMode === 'tribes' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Communities
                </button>
                <button
                  onClick={() => setFeedMode('discover')}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${feedMode === 'discover' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Discover
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">{feedDescriptions[feedMode] || 'Personalized feed'}</div>
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
                Want to create a post? Visit your <Link to={profilePath} className="text-blue-600 hover:text-blue-700 font-medium">profile/wall</Link> to share your thoughts!
              </div>
            </div>
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                  <div className="text-gray-500 text-lg">No posts in this category yet</div>
                  <p className="text-gray-400 mt-2">Be the first to share something!</p>
                </div>
              ) : (
                posts.map((post) => {
                  const media = extractMediaFromContent(post.content);
                  return (
                  <div key={post.id} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start space-x-3">
                      <img
                        className="h-10 w-10 rounded-full"
                        src={`https://ui-avatars.com/api/?name=${post.author_name || 'Anonymous'}&background=3B82F6&color=fff`}
                        alt={post.author_name || 'Anonymous'}
                        loading="lazy"
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
                            {post.group_name && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                c/{post.group_slug || post.group_name}
                              </span>
                            )}
                            {post.source_scope && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full uppercase">
                                {post.source_scope.replace('_', ' ')}
                              </span>
                            )}
                            {post.group_id && (
                              <Link
                                to={post.group_slug ? `/r/${post.group_slug}` : `/community/${post.group_id}`}
                                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                              >
                                c/{post.group_name || 'community'}
                              </Link>
                            )}
                            {/* TODO: Add category display when backend supports it */}
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Add friend request button for non-anonymous, non-self posts */}
                            {!post.is_anonymous && post.author?.username && !isOwnPost(post) && (
                              <button
                                onClick={() => {
                                  // Send friend request
                                  handleSendMessageRequest(post.user_id || post.author?.id);
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
                            media.text
                          )}
                        </div>
                        {editingPost !== post.id && media.images.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {media.images.map((url, idx) => (
                              <img
                                key={`${post.id}-img-${idx}`}
                                src={url}
                                alt="Post media"
                                className="w-full rounded-lg border object-contain bg-gray-50 max-h-[520px]"
                                loading="lazy"
                              />
                            ))}
                          </div>
                        )}
                        {editingPost !== post.id && media.videos.length > 0 && (
                          <div className="mt-3 space-y-3">
                            {media.videos.map((url, idx) => (
                              <video
                                key={`${post.id}-vid-${idx}`}
                                src={url}
                                controls
                                preload="metadata"
                                className="w-full rounded-lg border bg-black max-h-[520px]"
                              />
                            ))}
                          </div>
                        )}
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
                            onClick={() => handleComment(post)}
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
                  );
                })
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

            {/* Suggested Communities */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Suggested Communities</h3>
              <div className="space-y-2">
                {suggestedCommunities.map((community) => {
                  const path = community?.slug
                    ? `/r/${community.slug}`
                    : `/community/${community.id}`;
                  const memberCount = community?.member_count ?? community?.members_count ?? community?.members ?? 0;

                  return (
                  <Link
                    key={community.id}
                    to={path}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span>🏘️</span>
                      <span className="text-sm font-medium">g/{community.slug || community.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{memberCount} members</span>
                  </Link>
                  );
                })}
                {communities.length === 0 && (
                  <p className="text-xs text-gray-500">No communities available yet.</p>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="space-y-2">
                <Link to="/communities" className="block text-sm text-blue-600 hover:text-blue-700">
                  🏘️ Browse Communities
                </Link>
                <Link to="/requests" className="block text-sm text-blue-600 hover:text-blue-700">
                  👥 Request Center
                </Link>
                <Link to="/inbox" className="block text-sm text-blue-600 hover:text-blue-700">
                  💬 Inbox
                </Link>
                <Link to={profilePath} className="block text-sm text-blue-600 hover:text-blue-700">
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
