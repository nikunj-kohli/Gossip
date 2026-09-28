const Notification = require('../models/Notification');

/**
 * Fire-and-forget notification helper.
 *
 * Rules:
 *  - NEVER throws: notification failures must not fail like/comment/etc.
 *  - Never notifies a user about their own action.
 *  - Respects per-user notification_preferences (checked in Notification.create).
 *  - Emits live via Socket.IO user rooms (`user:${id}`), silently ignoring
 *    sockets being unavailable.
 */
const notify = async ({ userId, actorId, type, entityType, entityId, message, data = {} }) => {
  try {
    if (!userId || String(userId) === String(actorId)) {
      return null; // no self-notifications
    }

    const notification = await Notification.create({
      userId,
      actorId,
      type,
      entityType,
      entityId,
      message,
      data
    });

    if (notification && global.io) {
      try {
        global.io.to(`user:${userId}`).emit('notification:new', notification);
      } catch (socketError) {
        // Sockets are best-effort; DB row is the source of truth.
      }
    }

    return notification;
  } catch (error) {
    console.error(`Notification failure (${type}):`, error.message);
    return null;
  }
};

const notificationService = {
  /**
   * Post liked by actor.
   */
  notifyLike: (post, actor) =>
    notify({
      userId: post.user_id,
      actorId: actor.id,
      type: 'like',
      entityType: 'post',
      entityId: post.id,
      message: `${actor.display_name || actor.username} liked your post`,
      data: { postId: post.id, postExcerpt: (post.content || '').substring(0, 80) }
    }),

  /**
   * Comment added on a post (notifies post author; also notifies the parent
   * comment's author on replies, if different).
   */
  notifyComment: (post, actor, comment, parentComment = null) =>
    Promise.all([
      notify({
        userId: post.user_id,
        actorId: actor.id,
        type: 'comment',
        entityType: 'post',
        entityId: post.id,
        message: `${actor.display_name || actor.username} commented on your post`,
        data: { postId: post.id, commentId: comment.id }
      }),
      parentComment &&
        String(parentComment.user_id) !== String(post.user_id) &&
        notify({
          userId: parentComment.user_id,
          actorId: actor.id,
          type: 'comment',
          entityType: 'post',
          entityId: post.id,
          message: `${actor.display_name || actor.username} replied to your comment`,
          data: { postId: post.id, commentId: comment.id }
        })
    ]),

  /**
   * Connection (friend) request sent.
   */
  notifyFriendRequest: (targetUser, actor) =>
    notify({
      userId: targetUser.id,
      actorId: actor.id,
      type: 'friend_request',
      entityType: 'user',
      entityId: actor.id,
      message: `${actor.display_name || actor.username} sent you a message request`,
      data: { requesterId: actor.id, username: actor.username }
    }),

  /**
   * Connection request accepted.
   */
  notifyFriendAccepted: (requesterUser, actor) =>
    notify({
      userId: requesterUser.id,
      actorId: actor.id,
      type: 'friend_accepted',
      entityType: 'user',
      entityId: actor.id,
      message: `${actor.display_name || actor.username} accepted your message request`,
      data: { accepterId: actor.id, username: actor.username }
    })
};

module.exports = notificationService;
