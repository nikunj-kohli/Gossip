const Notification = require('../models/Notification');
const socketManager = require('./socketManager');

class NotificationService {
    // Create like notification
    static async createLikeNotification(postOrComment, actor) {
        try {
            // Skip if actor is the owner
            if (postOrComment.user_id === actor.id) {
                return null;
            }
            
            const isPost = postOrComment.hasOwnProperty('content');
            const entityType = isPost ? 'post' : 'comment';
            const contentPreview = isPost 
                ? postOrComment.content.substring(0, 50) 
                : postOrComment.text.substring(0, 50);
            
            const notification = await Notification.create({
                userId: postOrComment.user_id,
                actorId: actor.id,
                type: 'like',
                entityType,
                entityId: postOrComment.id,
                message: `${actor.display_name} liked your ${entityType}`,
                data: {
                    contentPreview: contentPreview + (contentPreview.length >= 50 ? '...' : '')
                }
            });
            
            if (notification) {
                // Send real-time notification via WebSocket
                this.sendRealTimeNotification(notification);
            }
            
            return notification;
        } catch (error) {
            console.error('Error creating like notification:', error);
            return null;
        }
    }
    
    // Create comment notification
    static async createCommentNotification(post, comment, actor) {
        try {
            // Skip if actor is the post owner
            if (post.user_id === actor.id) {
                return null;
            }
            
            const notification = await Notification.create({
                userId: post.user_id,
                actorId: actor.id,
                type: 'comment',
                entityType: 'post',
                entityId: post.id,
                message: `${actor.display_name} commented on your post`,
                data: {
                    commentPreview: comment.text.substring(0, 50) + (comment.text.length >= 50 ? '...' : ''),
                    postPreview: post.content.substring(0, 50) + (post.content.length >= 50 ? '...' : '')
                }
            });
            
            if (notification) {
                // Send real-time notification via WebSocket
                this.sendRealTimeNotification(notification);
            }
            
            return notification;
        } catch (error) {
            console.error('Error creating comment notification:', error);
            return null;
        }
    }
    
    // Create friend request notification
    static async createFriendRequestNotification(targetUser, requester) {
        try {
            const notification = await Notification.create({
                userId: targetUser.id,
                actorId: requester.id,
                type: 'friend_request',
                entityType: 'user',
                entityId: requester.id,
                message: `${requester.display_name} sent you a friend request`,
                data: {}
            });
            
            if (notification) {
                // Send real-time notification via WebSocket
                this.sendRealTimeNotification(notification);
            }
            
            return notification;
        } catch (error) {
            console.error('Error creating friend request notification:', error);
            return null;
        }
    }
    
    // Create friend acceptance notification
    static async createFriendAcceptedNotification(requester, accepter) {
        try {
            const notification = await Notification.create({
                userId: requester.id,
                actorId: accepter.id,
                type: 'friend_accepted',
                entityType: 'user',
                entityId: accepter.id,
                message: `${accepter.display_name} accepted your friend request`,
                data: {}
            });
            
            if (notification) {
                // Send real-time notification via WebSocket
                this.sendRealTimeNotification(notification);
            }
            
            return notification;
        } catch (error) {
            console.error('Error creating friend accepted notification:', error);
            return null;
        }
    }
    
    // Create post mention notification
    static async createPostMentionNotification(post, mentionedUser, author) {
        try {
            // Skip if mentioned user is the author
            if (mentionedUser.id === author.id) {
                return null;
            }
            
            const notification = await Notification.create({
                userId: mentionedUser.id,
                actorId: author.id,
                type: 'post_mention',
                entityType: 'post',
                entityId: post.id,
                message: `${author.display_name} mentioned you in a post`,
                data: {
                    postPreview: post.content.substring(0, 50) + (post.content.length >= 50 ? '...' : '')
                }
            });
            
            if (notification) {
                // Send real-time notification via WebSocket
                this.sendRealTimeNotification(notification);
            }
            
            return notification;
        } catch (error) {
            console.error('Error creating post mention notification:', error);
            return null;
        }
    }
    
    // Create comment mention notification
    static async createCommentMentionNotification(comment, mentionedUser, author) {
        try {
            // Skip if mentioned user is the author
            if (mentionedUser.id === author.id) {
                return null;
            }
            
            const notification = await Notification.create({
                userId: mentionedUser.id,
                actorId: author.id,
                type: 'comment_mention',
                entityType: 'comment',
                entityId: comment.id,
                message: `${author.display_name} mentioned you in a comment`,
                data: {
                    commentPreview: comment.text.substring(0, 50) + (comment.text.length >= 50 ? '...' : '')
                }
            });
            
            if (notification) {
                // Send real-time notification via WebSocket
                this.sendRealTimeNotification(notification);
            }
            
            return notification;
        } catch (error) {
            console.error('Error creating comment mention notification:', error);
            return null;
        }
    }
    
    // Create group invite notification
    static async createGroupInviteNotification(group, invitedUser, inviter) {
        try {
            const notification = await Notification.create({
                userId: invitedUser.id,
                actorId: inviter.id,
                type: 'group_invite',
                entityType: 'group',
                entityId: group.id,
                message: `${inviter.display_name} invited you to join ${group.name}`,
                data: {
                    groupName: group.name,
                    groupDescription: group.description
                }
            });
            
            if (notification) {
                // Send real-time notification via WebSocket
                this.sendRealTimeNotification(notification);
            }
            
            return notification;
        } catch (error) {
            console.error('Error creating group invite notification:', error);
            return null;
        }
    }
    
    // Create group post notification
    static async createGroupPostNotification(group, post, author) {
        try {
            // Get all group members except the author
            // This would normally be done through a GroupMember model query
            // But for simplicity, we'll assume we receive an array of user IDs
            const memberIds = []; // Replace with actual member IDs retrieval
            
            const notifications = [];
            
            for (const memberId of memberIds) {
                // Skip if member is the author
                if (memberId === author.id) {
                    continue;
                }
                
                const notification = await Notification.create({
                    userId: memberId,
                    actorId: author.id,
                    type: 'group_post',
                    entityType: 'post',
                    entityId: post.id,
                    message: `${author.display_name} posted in ${group.name}`,
                    data: {
                        groupName: group.name,
                        postPreview: post.content.substring(0, 50) + (post.content.length >= 50 ? '...' : '')
                    }
                });
                
                if (notification) {
                    // Send real-time notification via WebSocket
                    this.sendRealTimeNotification(notification);
                    notifications.push(notification);
                }
            }
            
            return notifications;
        } catch (error) {
            console.error('Error creating group post notifications:', error);
            return [];
        }
    }
    
    // Send real-time notification via WebSocket
    static sendRealTimeNotification(notification) {
        try {
            const socketId = socketManager.getSocketId(notification.user_id);
            
            if (socketId) {
                socketManager.emitToUser(
                    notification.user_id,
                    'notification',
                    notification
                );
            }
        } catch (error) {
            console.error('Error sending real-time notification:', error);
        }
    }
}

module.exports = NotificationService;