import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { getUserProfile, checkMessagingAccessStatus, startInboxConversation, createPost, getUserPosts, getPostById, toggleLike, updatePost, deletePost, sendMessageRequest, uploadPostMedia } from '../api';

const ProfilePage = () => {
  const { username } = useParams();
  const { user: currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [canMessage, setCanMessage] = useState(false);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error } = await getUserProfile(username);
        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfileUser(data);
          // Check if this is current user
          setIsCurrentUser(currentUser?.username === username);
          
          // Check friendship status if not current user
          if (currentUser?.username !== username) {
            console.log('Checking friendship status for:', username);
            const friendshipResult = await checkMessagingAccessStatus(username);
            console.log('Friendship result:', friendshipResult);
            if (!friendshipResult.error) {
              console.log('Setting canMessage to:', friendshipResult.data.canMessage);
              setCanMessage(Boolean(friendshipResult.data.canMessage));
            } else {
              console.log('Friendship check error:', friendshipResult.error);
              setCanMessage(false);
            }
          }
          
          // Fetch user's posts
          await fetchUserPosts(data.id);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setLoading(false);
      }
    };

    if (username) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [username, currentUser]);

  const fetchUserPosts = async (userId) => {
    try {
      const { data, error } = await getUserPosts(userId);
      if (error) {
        console.error('Error fetching user posts:', error);
        setPosts([]);
      } else {
        setPosts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching user posts:', err);
      setPosts([]);
    }
  };

  const handleSendMessageRequest = async () => {
    try {
      if (!profileUser?.id) return;
      const { error } = await sendMessageRequest(profileUser.id);
      if (error) {
        alert(error.response?.data?.message || 'Failed to send request');
        return;
      }
      alert('Message request sent.');
    } catch (error) {
      console.error('Error sending request:', error);
      alert('Failed to send request');
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

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && mediaFiles.length === 0) return;

    setIsSubmitting(true);
    try {
      const uploadedMedia = [];
      for (const file of mediaFiles) {
        const { data, error: uploadError } = await uploadPostMedia(file);
        if (uploadError || !data?.url) {
          alert(uploadError?.response?.data?.message || uploadError?.message || 'Failed to upload media');
          return;
        }
        uploadedMedia.push(data.url);
      }

      const normalizedContent = [newPost.trim(), ...uploadedMedia].filter(Boolean).join('\n');

      const { data, error } = await createPost({
        content: normalizedContent,
        visibility: 'public',
        isAnonymous: isAnonymous,
        postType: uploadedMedia.length > 0 ? 'media' : 'text'
      });
      
      if (error) {
        console.error('Error creating post:', error);
        if (error.response?.status === 403) {
          alert('Authentication failed. Please log in again.');
          return;
        }
        alert(`Failed to create post: ${error.message || 'Please try again.'}`);
        return;
      }
      
      if (data && data.id && data.content) {
        setPosts(prevPosts => [data, ...prevPosts]);
        setNewPost('');
        setIsAnonymous(false);
        setMediaFiles([]);
      } else {
        console.error('Invalid post data returned:', data);
        alert('Post created but data is invalid. Please refresh the page.');
        await fetchUserPosts(profileUser.id);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      if (error.response?.status === 403) {
        alert('Authentication failed. Please log in again.');
      } else {
        alert(`Failed to create post: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsSubmitting(false);
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

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const isOwnPost = (post) => {
    return post.user_id === currentUser?.id;
  };

  const handleMessageUser = async () => {
    try {
      console.log('Starting conversation with:', username);
      
      // Use the user ID from profile data instead of username
      const userId = profileUser?.id;
      
      if (!userId) {
        console.error('User ID not available from profile data');
        alert('Cannot start conversation: User information incomplete');
        return;
      }
      
      console.log('Using user ID:', userId);
      const { data, error } = await startInboxConversation(userId);
      if (error) {
        console.error('Error starting conversation:', error);
        alert('Failed to start conversation');
      } else {
        console.log('Conversation started:', data);
        // Navigate to messages with the conversation ID
        navigate(`/inbox/${data.conversationId || data.id}`);
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to start conversation');
    }
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

  const openPostDetail = async (post) => {
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
      if (error || !data?.permalink) return;
      navigate(`${data.permalink}#comments`);
    } catch (error) {
      console.error('Error opening post detail:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">User Not Found</h2>
          <p className="text-gray-600">The user @{username} was not found.</p>
          <Link to="/feed" className="text-blue-600 hover:text-blue-700 mt-4">
            ← Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-center bg-cover rounded-full border-2 border-gray-200" 
                   style={{backgroundImage: `url("${profileUser?.avatar_url || `https://ui-avatars.com/api/?name=${profileUser?.display_name || profileUser?.username}&background=3B82F6&color=fff`}")`}}>
              </div>
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    {profileUser?.display_name || profileUser?.username}
                  </h1>
                  <p className="text-gray-600 mb-4">
                    @{profileUser?.username}
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  {!isCurrentUser && !canMessage && (
                    <button 
                      onClick={handleSendMessageRequest}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Request to Message
                    </button>
                  )}
                  {!isCurrentUser && canMessage && (
                    <>
                      <button 
                        onClick={handleMessageUser}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Message
                      </button>
                      <span className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg">Connected</span>
                    </>
                  )}
                  {isCurrentUser && (
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>
              
              {/* Bio */}
              {profileUser?.bio && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700">{profileUser.bio}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Posts Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Posts</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              {canMessage && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  Can Message
                </span>
              )}
              {!canMessage && !isCurrentUser && (
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                  Request Required
                </span>
              )}
            </div>
          </div>
          
          {/* Create Post - Only for current user */}
          {isCurrentUser && (
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
              <form onSubmit={handleCreatePost}>
                <div className="flex items-start space-x-3">
                  <img
                    className="h-10 w-10 rounded-full"
                    src={currentUser?.avatar_url || `https://ui-avatars.com/api/?name=${currentUser?.displayName || currentUser?.username}&background=3B82F6&color=fff`}
                    alt={currentUser?.displayName || currentUser?.username}
                  />
                  <div className="flex-1">
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="What's on your mind? Add text or attach photos/videos."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows="3"
                    />
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => setMediaFiles(Array.from(e.target.files || []).slice(0, 4))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      {mediaFiles.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">{mediaFiles.length} file(s) selected</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={isAnonymous}
                            onChange={(e) => setIsAnonymous(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Anonymous</span>
                        </label>
                      </div>
                      <button
                        type="submit"
                        disabled={(!newPost.trim() && mediaFiles.length === 0) || isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md text-sm font-medium disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}
          
          {/* Posts Display */}
          {(isCurrentUser || canMessage) && (
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg font-medium mb-2">No posts yet</p>
                  <p className="text-sm">
                    {isCurrentUser ? 'Share your thoughts with the community!' : 'This user hasn\'t posted anything yet.'}
                  </p>
                </div>
              ) : (
                posts.map((post) => {
                  const media = extractMediaFromContent(post.content);
                  return (
                  <div key={post.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <img
                            className="h-8 w-8 rounded-full"
                            src={`https://ui-avatars.com/api/?name=${post.is_anonymous ? 'Anonymous' : profileUser?.display_name || profileUser?.username}&background=3B82F6&color=fff`}
                            alt={post.is_anonymous ? 'Anonymous' : profileUser?.display_name || profileUser?.username}
                          />
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {post.is_anonymous ? 'Anonymous' : profileUser?.display_name || profileUser?.username}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{formatTimeAgo(post.created_at)}</span>
                              {post.group_name && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                  c/{post.group_slug || post.group_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-gray-800 whitespace-pre-wrap mb-3">
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                            {media.images.map((url, idx) => (
                              <img key={`${post.id}-img-${idx}`} src={url} alt="Post media" className="w-full rounded-lg border object-cover" />
                            ))}
                          </div>
                        )}
                        {editingPost !== post.id && media.videos.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {media.videos.map((url, idx) => (
                              <video key={`${post.id}-vid-${idx}`} src={url} controls className="w-full rounded-lg border" preload="metadata" />
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-4">
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
                            onClick={() => openPostDetail(post)}
                            className="flex items-center space-x-1 text-gray-500 hover:text-blue-600 transition-colors"
                          >
                            <span>💬</span>
                            <span className="text-sm">{post.comments_count || 0}</span>
                          </button>
                          <button className="flex items-center space-x-1 text-gray-500 hover:text-green-600 transition-colors">
                            <span>🔄</span>
                            <span className="text-sm">Share</span>
                          </button>
                          {isCurrentUser && isOwnPost(post) && (
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
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          )}
          
          {/* Private Profile Message */}
          {!isCurrentUser && !canMessage && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium mb-2">Private Profile</p>
              <p className="text-sm">Send a friend request to see their posts.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
