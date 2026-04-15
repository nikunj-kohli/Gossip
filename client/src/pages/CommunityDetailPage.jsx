import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import {
  getCommunityById,
  getCommunityByName,
  getUserMemberships,
  joinCommunity,
  leaveCommunity,
  getGroupPosts,
  getPostById,
  toggleLike,
  sharePost,
  deletePost,
  warnCommunityPost,
} from '../api';
import { SkeletonBlock, SkeletonCard } from '../components/Skeletons';
import { normalizeMediaContent } from '../utils/mediaContent';

const CommunityDetailPage = () => {
  const { user } = React.useContext(AuthContext);
  const navigate = useNavigate();
  const { communityName } = useParams();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postActionLoading, setPostActionLoading] = useState({});

  useEffect(() => {
    const fetchCommunity = async () => {
      if (!communityName) return;
      
      try {
        let group = null;

        // First try to get by name/slug
        const { data, error } = await getCommunityByName(communityName);
        
        if (error || !data?.group) {
          // If not found by name, try by ID
          const { data: dataById, error: errorById } = await getCommunityById(communityName);
          
          if (errorById || !dataById?.group) {
            setLoading(false);
            return;
          }

          group = dataById.group;
        } else {
          group = data.group;
        }

        setCommunity(group);

        let memberFromMemberships = false;
        if (user) {
          const { data: membershipsData, error: membershipsError } = await getUserMemberships();
          if (!membershipsError) {
            const memberships = Array.isArray(membershipsData)
              ? membershipsData
              : (membershipsData?.groups || membershipsData?.memberships || []);
            memberFromMemberships = memberships.some(
              (membership) => (membership.group_id || membership.id) === group.id
            );
          }
        }

        setIsMember(Boolean(group.is_member) || memberFromMemberships);
      } catch (error) {
        console.error('Error fetching community:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunity();
  }, [communityName]);

  useEffect(() => {
    const loadCommunityPosts = async () => {
      if (!community?.id) return;

      try {
        setPostsLoading(true);
        const { data, error } = await getGroupPosts(community.id, { limit: 30, offset: 0 });

        if (error) {
          console.error('Error loading community posts:', error);
          setPosts([]);
          return;
        }

        const rows = Array.isArray(data)
          ? data
          : (Array.isArray(data?.posts) ? data.posts : []);

        setPosts(rows);
      } catch (error) {
        console.error('Error loading community posts:', error);
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };

    loadCommunityPosts();
  }, [community?.id]);

  const handleJoinCommunity = async () => {
    if (!user) {
      alert('Please log in to join communities');
      return;
    }

    try {
      const { data, error } = await joinCommunity(community.id);
      
      if (error) {
        const errorMessage = error.response?.data?.message || error.message || '';

        // If server says user is already a member, sync UI state instead of showing an error.
        if (error.response?.status === 400 && /already a member/i.test(errorMessage)) {
          setIsMember(true);
          return;
        }

        console.error('Error joining community:', error);
        alert(errorMessage || 'Failed to join community');
      } else {
        setIsMember(true);
        alert('Successfully joined community!');
      }
    } catch (error) {
      console.error('Error joining community:', error);
      alert('Failed to join community');
    }
  };

  const handleLeaveCommunity = async () => {
    if (!user) return;

    try {
      const { data, error } = await leaveCommunity(community.id);
      
      if (error) {
        console.error('Error leaving community:', error);
        alert(error.message || 'Failed to leave community');
      } else {
        setIsMember(false);
        alert('Successfully left community!');
      }
    } catch (error) {
      console.error('Error leaving community:', error);
      alert('Failed to leave community');
    }
  };

  const isCreator = community?.creator_id === user?.id;
  const isAdmin = community?.user_role === 'admin' || community?.user_role === 'creator';
  const isActuallyMember = isMember || isCreator; // Also consider creators as members
  const canCreatePost = Boolean(user && isActuallyMember);

  const handleDeleteCommunityPost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;

    try {
      const { error } = await deletePost(postId);
      if (error) {
        const message = error.response?.data?.message || error.message || 'Failed to delete post';
        alert(message);
        return;
      }

      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  };

  const handleOpenPostDetail = async (post, focusComments = false) => {
    try {
      if (post?.permalink) {
        navigate(focusComments ? `${post.permalink}#comments` : post.permalink);
        return;
      }

      if (!post?.id) return;
      const { data, error } = await getPostById(post.id);

      if (!error && data?.permalink) {
        navigate(focusComments ? `${data.permalink}#comments` : data.permalink);
        return;
      }

      navigate(`/p/${post.id}${focusComments ? '#comments' : ''}`);
    } catch (error) {
      console.error('Error opening post detail:', error);
      alert('Unable to open this post right now.');
    }
  };

  const handleLikePost = async (postId) => {
    setPostActionLoading((prev) => ({ ...prev, [postId]: true }));

    try {
      const { data, error } = await toggleLike(postId);
      if (error) {
        alert(error.response?.data?.message || 'Failed to toggle like');
        return;
      }

      setPosts((prev) => prev.map((post) => {
        if (post.id !== postId) return post;

        const liked = Boolean(data?.liked);
        const likesCount = Number(post.likes_count || 0) + (liked ? 1 : -1);

        return {
          ...post,
          user_liked: liked,
          likes_count: Math.max(0, likesCount),
        };
      }));
    } catch (error) {
      console.error('Error toggling post like:', error);
      alert('Failed to toggle like');
    } finally {
      setPostActionLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleSharePost = async (post) => {
    try {
      const { data, error } = await sharePost(post.id);
      if (error) {
        alert(error.response?.data?.message || 'Failed to share post');
        return;
      }

      const permalink = data?.permalink || post.permalink;
      if (!permalink) {
        alert('Share link is unavailable right now.');
        return;
      }

      const absoluteUrl = `${window.location.origin}${permalink}`;

      if (navigator.share) {
        await navigator.share({
          title: 'Gossip Post',
          text: 'Check out this post',
          url: absoluteUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(absoluteUrl);
      alert('Post link copied to clipboard.');
    } catch (error) {
      // Ignore user-cancelled share sheet errors.
      if (error?.name === 'AbortError') return;
      console.error('Error sharing post:', error);
      alert('Failed to share post');
    }
  };

  const handleWarnPost = async (postId) => {
    const reason = window.prompt('Optional warning reason for this post:') || null;

    try {
      const { error } = await warnCommunityPost(postId, reason);
      if (error) {
        const message = error.response?.data?.message || error.message || 'Failed to warn user';
        alert(message);
        return;
      }

      alert('Post author warned successfully.');
      setPosts((prev) => prev.map((post) => (
        post.id === postId
          ? { ...post, moderation_status: 'flagged' }
          : post
      )));
    } catch (error) {
      console.error('Error warning post author:', error);
      alert('Failed to warn post author');
    }
  };

  const canDeletePost = (post) => {
    if (!user) return false;
    const isPostOwner = parseInt(post.user_id) === parseInt(user.id);
    return isPostOwner || isCreator;
  };

  const canWarnPost = (post) => {
    if (!user || !isCreator) return false;
    return parseInt(post.user_id) !== parseInt(user.id);
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

  const communityCover = community?.cover_url
    || `https://picsum.photos/seed/${encodeURIComponent(community?.slug || community?.name || 'community')}/1600/520`;

  const communityAvatar = community?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(community?.name || 'community')}&background=0F766E&color=fff&size=120`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <SkeletonCard media lines={3} footer />
          <div className="space-y-4">
            <SkeletonBlock className="h-7 w-48" />
            <SkeletonCard avatar lines={3} footer />
            <SkeletonCard avatar lines={4} footer />
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-lg">Community not found</div>
          <Link
            to="/communities"
            className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Back to Communities
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="editorial-card overflow-hidden">
          <div className="h-56 w-full overflow-hidden">
            <img className="h-full w-full object-cover" src={communityCover} alt={`${community.name} cover`} loading="lazy" />
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <img
                  className="h-16 w-16 rounded-xl border border-[#d8d2c6]"
                  src={communityAvatar}
                  alt={community.name}
                  loading="lazy"
                />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">c/{community.name}</h2>
                  <p className="text-gray-600">{community.description || 'No description available'}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                      {community.privacy === 'private' ? 'Private' : 'Public'}
                    </span>
                    <span className="text-sm text-gray-500">
                      Created by {community.creator_name || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
                {user && (
                  <>
                    {!isActuallyMember ? (
                      <button
                        onClick={handleJoinCommunity}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Join Community
                      </button>
                    ) : (
                      <span className="inline-flex items-center justify-center bg-green-100 text-green-800 px-4 py-2 rounded-md text-sm font-semibold">
                        JOINED
                      </span>
                    )}

                    {isActuallyMember && !isCreator && (
                      <button
                        onClick={handleLeaveCommunity}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Leave Community
                      </button>
                    )}
                    
                    {(isCreator || isAdmin) && (
                      <Link
                        to={`/r/${community.slug || community.id}/manage`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium text-center"
                      >
                        Manage Community
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Community Posts</h3>

              {isActuallyMember && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    💡 To post in this community, go to your <Link to="/wall" className="font-semibold underline">Wall</Link>, 
                    select "Select Community" and choose this community.
                  </p>
                </div>
              )}

              {postsLoading ? (
                <div className="space-y-4">
                  <SkeletonCard avatar lines={3} footer />
                  <SkeletonCard avatar lines={4} footer />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No posts yet. Be the first to post.</div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => {
                    const authorName = post.author_name || 'Unknown';
                    const flagged = post.moderation_status === 'flagged';

                    return (
                      <div key={post.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{authorName}</div>
                            <div className="text-xs text-gray-500">{formatTimeAgo(post.created_at)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {flagged && (
                              <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">Flagged</span>
                            )}
                            {canWarnPost(post) && (
                              <button
                                onClick={() => handleWarnPost(post.id)}
                                className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 px-2 py-1 rounded"
                              >
                                Warn
                              </button>
                            )}
                            {canDeletePost(post) && (
                              <button
                                onClick={() => handleDeleteCommunityPost(post.id)}
                                className="text-xs bg-red-100 text-red-800 hover:bg-red-200 px-2 py-1 rounded"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        {(() => {
                          const media = normalizeMediaContent(post.content);
                          return (
                            <div className="mt-3 space-y-3 cursor-pointer" onClick={() => handleOpenPostDetail(post)}>
                              {media.text && (
                                <p className="text-gray-800 whitespace-pre-wrap">{media.text}</p>
                              )}
                              {media.images.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {media.images.map((url, idx) => (
                                    <img key={`${post.id}-img-${idx}`} src={url} alt="Post media" className="w-full rounded-lg border object-cover" loading="lazy" />
                                  ))}
                                </div>
                              )}
                              {media.videos.length > 0 && (
                                <div className="space-y-2">
                                  {media.videos.map((url, idx) => (
                                    <video key={`${post.id}-vid-${idx}`} src={url} controls className="w-full rounded-lg border" preload="metadata" />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <div className="mt-2 text-xs text-gray-500">
                          {(post.likes_count || 0)} likes · {(post.comments_count || 0)} comments
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => handleLikePost(post.id)}
                            disabled={Boolean(postActionLoading[post.id])}
                            className={`text-xs px-3 py-1 rounded ${post.user_liked ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} disabled:opacity-60`}
                          >
                            {post.user_liked ? 'Unlike' : 'Like'}
                          </button>
                          <button
                            onClick={() => handleOpenPostDetail(post, true)}
                            className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-3 py-1 rounded"
                          >
                            Comment
                          </button>
                          <button
                            onClick={() => handleSharePost(post)}
                            className="text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-3 py-1 rounded"
                          >
                            Share
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityDetailPage;
