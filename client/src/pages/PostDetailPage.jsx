import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { addPostComment, getPostById, getPostByPermalink, getPostComments, toggleCommentLike, toggleLike } from '../api';
import { SkeletonBlock, SkeletonCard } from '../components/Skeletons';

const PostDetailPage = () => {
  const { communitySlug, headline, dateAndToken, legacyId } = useParams();
  const navigate = useNavigate();
  const { user } = React.useContext(AuthContext);
  const commentsRef = useRef(null);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentIsAnonymous, setCommentIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [commentSort, setCommentSort] = useState('top');
  const [collapsedComments, setCollapsedComments] = useState({});

  const loadPost = async () => {
    setLoading(true);
    try {
      // Backward compatibility: convert /p/:id to canonical permalink and replace URL.
      if (legacyId) {
        const id = parseInt(legacyId, 10);
        if (!id) {
          setPost(null);
          setComments([]);
          return;
        }

        const legacyRes = await getPostById(id);
        if (legacyRes?.data?.permalink) {
          navigate(`${legacyRes.data.permalink}${window.location.hash || ''}`, { replace: true });
          return;
        }

        setPost(null);
        setComments([]);
        return;
      }

      const decodeTokenToId = (compound) => {
        try {
          const token = String(compound || '').slice(9);
          if (!token) return null;
          const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
          const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
          const decoded = atob(padded);
          const id = parseInt(decoded.split(':')[0], 10);
          return Number.isNaN(id) ? null : id;
        } catch (e) {
          return null;
        }
      };

      let resolvedPost = null;
      const permalinkRes = await getPostByPermalink({ communitySlug, headline, dateAndToken });
      if (!permalinkRes.error && permalinkRes.data) {
        resolvedPost = permalinkRes.data;
      } else {
        // Rescue path: decode token and resolve by id for strict/legacy permalink validators.
        const fallbackId = decodeTokenToId(dateAndToken);
        if (fallbackId) {
          const byIdRes = await getPostById(fallbackId);
          if (!byIdRes.error && byIdRes.data) {
            resolvedPost = byIdRes.data;
          }
        }
      }

      if (!resolvedPost) {
        setPost(null);
        setComments([]);
        return;
      }

      if (resolvedPost.canonical_permalink && resolvedPost.canonical_permalink !== window.location.pathname) {
        navigate(`${resolvedPost.canonical_permalink}${window.location.hash || ''}`, { replace: true });
      }

      setPost(resolvedPost);
      const commentsRes = await getPostComments(resolvedPost.id, { limit: 100, offset: 0 });
      const rows = Array.isArray(commentsRes?.data?.comments)
        ? commentsRes.data.comments
        : [];
      setComments(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPost();
  }, [communitySlug, headline, dateAndToken, legacyId]);

  useEffect(() => {
    if (!loading && post && window.location.hash === '#comments' && commentsRef.current) {
      commentsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, post]);

  const onLike = async () => {
    if (!post) return;
    const { data } = await toggleLike(post.id);
    if (!data) return;
    setPost((prev) => ({
      ...prev,
      userLiked: data.liked,
      likes_count: (prev.likes_count || 0) + (data.liked ? 1 : -1),
    }));
  };

  const onComment = async () => {
    if (!post || !commentText.trim()) {
      alert('Please write a comment');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await addPostComment(post.id, {
        content: commentText.trim(), 
        isAnonymous: commentIsAnonymous,
        parentCommentId: replyingTo?.id || null,
      });
      
      if (error || !data?.comment) {
        alert(error?.response?.data?.message || 'Failed to post comment');
        setIsSubmitting(false);
        return;
      }

      setComments((prev) => [...prev, data.comment]);
      setPost((prev) => ({ ...prev, comments_count: (prev.comments_count || 0) + 1 }));
      setCommentText('');
      setCommentIsAnonymous(false);
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMediaContent = (content) => {
    // Check for GIF URLs
    const gifRegex = /https?:\/\/.*\.(gif|giphy|tenor|media\.giphy)/i;
    if (gifRegex.test(content)) {
      const url = content.match(/https?:\/\/[^\s]+/)?.[0];
      if (url) {
        return (
          <>
            <p className="text-gray-900 whitespace-pre-wrap mb-3">{content}</p>
            <img 
              src={url} 
              alt="gif" 
              className="max-w-md rounded-lg border border-gray-300"
              onError={() => console.log('Image load error')}
            />
          </>
        );
      }
    }

    // Check for image URLs
    const imageRegex = /https?:\/\/.*\.(png|jpg|jpeg|webp)/i;
    if (imageRegex.test(content)) {
      const url = content.match(/https?:\/\/[^\s]+/)?.[0];
      if (url) {
        return (
          <>
            <p className="text-gray-900 whitespace-pre-wrap mb-3">{content}</p>
            <img 
              src={url} 
              alt="post" 
              className="max-w-md rounded-lg border border-gray-300"
              onError={() => console.log('Image load error')}
            />
          </>
        );
      }
    }

    return <p className="text-gray-900 whitespace-pre-wrap">{content}</p>;
  };

  const buildCommentTree = (rows) => {
    const byId = new Map();
    const roots = [];

    rows.forEach((row) => {
      byId.set(row.id, { ...row, replies: [] });
    });

    rows.forEach((row) => {
      const node = byId.get(row.id);
      if (row.parent_comment_id && byId.has(row.parent_comment_id)) {
        byId.get(row.parent_comment_id).replies.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const sortCommentNodes = (nodes) => {
    const sorted = [...nodes];

    if (commentSort === 'new') {
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (commentSort === 'old') {
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
      sorted.sort((a, b) => {
        const scoreA = (a.likes_count || 0) * 10 + (a.replies?.length || 0);
        const scoreB = (b.likes_count || 0) * 10 + (b.replies?.length || 0);
        return scoreB - scoreA;
      });
    }

    return sorted.map((node) => ({
      ...node,
      replies: Array.isArray(node.replies) ? sortCommentNodes(node.replies) : [],
    }));
  };

  const onCommentLike = async (commentId) => {
    if (!post?.id || !commentId) return;

    try {
      const { data, error } = await toggleCommentLike(post.id, commentId);
      if (error || !data) return;

      setComments((prev) => prev.map((comment) => {
        if (comment.id !== commentId) return comment;
        return {
          ...comment,
          user_liked: data.liked,
          likes_count: data.likesCount,
        };
      }));
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const toggleCommentCollapse = (commentId) => {
    setCollapsedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const renderCommentNode = (comment, depth = 0) => {
    const maxDepth = 4;
    const indentClass = depth > 0 ? 'ml-4 md:ml-8' : '';
    const safeDepth = Math.min(depth, maxDepth);

    return (
      <div key={comment.id} className={`${indentClass} ${safeDepth > 0 ? 'border-l-2 border-gray-200 pl-3' : ''}`}>
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                {comment.author?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold text-gray-900">{comment.author || 'Anonymous'}</span>
                <span>•</span>
                <span>{formatTime(comment.created_at)}</span>
              </div>

              <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                {renderMediaContent(comment.content)}
              </div>

              <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                <button
                  onClick={() => onCommentLike(comment.id)}
                  className={`transition ${comment.user_liked ? 'text-red-600' : 'hover:text-red-600'}`}
                >
                  {comment.user_liked ? '❤️' : '🤍'} {comment.likes_count || 0}
                </button>
                <button
                  onClick={() => {
                    setReplyingTo({ id: comment.id, author: comment.author || 'User' });
                    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="hover:text-blue-600 transition"
                >
                  ↩️ Reply
                </button>
                {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                  <button
                    onClick={() => toggleCommentCollapse(comment.id)}
                    className="hover:text-gray-900 transition"
                  >
                    {collapsedComments[comment.id] ? `▶ Show replies (${comment.replies.length})` : `▼ Hide replies (${comment.replies.length})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {Array.isArray(comment.replies) && comment.replies.length > 0 && !collapsedComments[comment.id] && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => renderCommentNode(reply, safeDepth + 1))}
          </div>
        )}
      </div>
    );
  };

  const threadedComments = sortCommentNodes(buildCommentTree(comments));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <SkeletonCard media lines={4} footer />
          <SkeletonBlock className="h-7 w-44" />
          <SkeletonCard avatar lines={3} footer />
          <SkeletonCard avatar lines={3} footer />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Post not found</h2>
          <Link to="/feed" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">← Back to feed</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Post */}
        <div className="bg-white rounded-lg shadow border mb-4">
          <div className="p-4">
            {/* Post Header */}
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
              <span className="font-semibold">{post.author_name || 'Anonymous'}</span>
              <span>•</span>
              <span>{formatTime(post.created_at)}</span>
              {post.group_name && (
                <>
                  <span>•</span>
                  <Link to={post.group_slug ? `/r/${post.group_slug}` : `/community/${post.group_id}`} className="text-blue-600 hover:text-blue-700 font-semibold">
                    🏘️ c/{post.group_slug || post.group_name}
                  </Link>
                </>
              )}
            </div>

            {/* Post Content */}
            <div className="mb-4">
              {renderMediaContent(post.content)}
            </div>

            {/* Post Stats */}
            <div className="flex items-center gap-6 text-sm text-gray-600 py-2 border-t border-b border-gray-200">
              <button 
                onClick={onLike}
                className={`flex items-center gap-2 ${post.userLiked ? 'text-red-600' : 'hover:text-red-600'} transition`}
              >
                {post.userLiked ? '❤️' : '🤍'} {post.likes_count || 0}
              </button>
              <span className="flex items-center gap-2">💬 {post.comments_count || 0}</span>
              <span className="flex items-center gap-2">🔄 {post.shares_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Comment Box */}
        {user && (
          <div className="bg-white rounded-lg shadow border p-4 mb-4">
            <div className="flex gap-3">
              <img
                src={`https://ui-avatars.com/api/?name=${user.displayName || user.username}&background=3B82F6&color=fff&size=40`}
                alt={user.username}
                className="w-10 h-10 rounded-full"
              />
              <div className="flex-1">
                {replyingTo && (
                  <div className="mb-2 p-2 bg-blue-50 rounded text-sm">
                    Replying to <strong>{replyingTo.author}</strong>
                    <button 
                      onClick={() => setReplyingTo(null)}
                      className="ml-2 text-blue-600 hover:text-blue-700 text-xs"
                    >
                      clear
                    </button>
                  </div>
                )}
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="What are your thoughts?"
                  className="w-full border border-gray-300 rounded p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={commentIsAnonymous}
                    onChange={(e) => setCommentIsAnonymous(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Comment anonymously
                </label>
                <button 
                  onClick={onComment}
                  disabled={isSubmitting || !commentText.trim()}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium transition"
                >
                  {isSubmitting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div id="comments" ref={commentsRef} className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{comments.length} Comments</h3>
            <select
              value={commentSort}
              onChange={(e) => setCommentSort(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="top">Top</option>
              <option value="new">New</option>
              <option value="old">Old</option>
            </select>
          </div>
          
          {comments.length === 0 && (
            <div className="bg-white rounded-lg shadow border p-6 text-center text-gray-500">
              No comments yet. Be the first to share your thoughts!
            </div>
          )}

          {threadedComments.map((comment) => renderCommentNode(comment))}
        </div>
      </div>
    </div>
  );
};

export default PostDetailPage;
