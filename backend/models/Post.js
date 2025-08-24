const db = require('../config/database');

class Post {
    // Create new post with visibility option
    static async create({ userId, content, isAnonymous = false, postType = 'text', visibility = 'public' }) {
        try {
            // Validate visibility option
            const validVisibility = ['public', 'friends', 'private'];
            if (!validVisibility.includes(visibility)) {
                visibility = 'public';
            }

            const query = `
                INSERT INTO posts (user_id, content, is_anonymous, post_type, visibility)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, user_id, content, is_anonymous, post_type, visibility, likes_count, comments_count, created_at
            `;
            
            const result = await db.query(query, [userId, content, isAnonymous, postType, visibility]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Create post in a group
    static async createInGroup({ userId, groupId, content, isAnonymous = false, postType = 'text' }) {
        try {
            const query = `
                INSERT INTO posts (user_id, group_id, content, is_anonymous, post_type, visibility)
                VALUES ($1, $2, $3, $4, $5, 'public')
                RETURNING id, user_id, group_id, content, is_anonymous, post_type, visibility, likes_count, comments_count, created_at
            `;
            
            const result = await db.query(query, [userId, groupId, content, isAnonymous, postType]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Get all posts (feed) - public posts only
    static async getAll(limit = 20, offset = 0, userId = null) {
        try {
            let query = `
                SELECT 
                    p.id, 
                    p.content,
                    p.is_anonymous, 
                    p.post_type,
                    p.likes_count,
                    p.comments_count,
                    p.created_at,
                    p.visibility,
                    CASE 
                        WHEN p.is_anonymous = true THEN 'Anonymous'
                        ELSE u.display_name
                    END as author_name,
                    CASE 
                        WHEN p.is_anonymous = true THEN NULL
                        ELSE u.username
                    END as author_username
            `;
            
            // If userId is provided, add a field to show if user liked the post
            if (userId) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM likes 
                        WHERE post_id = p.id AND user_id = $3
                    )) as user_liked
                `;
            } else {
                query += `, false as user_liked`;
            }
            
            query += `
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.is_active = true
                AND p.visibility = 'public'
                AND p.group_id IS NULL
                ORDER BY p.created_at DESC
                LIMIT $1 OFFSET $2
            `;
            
            const result = userId 
                ? await db.query(query, [limit, offset, userId])
                : await db.query(query, [limit, offset]);
                
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    // Get posts from a group
    static async getGroupPosts(groupId, userId = null, limit = 20, offset = 0) {
        try {
            let query = `
                SELECT 
                    p.id, 
                    p.content,
                    p.is_anonymous, 
                    p.post_type,
                    p.group_id,
                    p.likes_count,
                    p.comments_count,
                    p.created_at,
                    p.visibility,
                    CASE 
                        WHEN p.is_anonymous = true THEN 'Anonymous'
                        ELSE u.display_name
                    END as author_name,
                    CASE 
                        WHEN p.is_anonymous = true THEN NULL
                        ELSE u.username
                    END as author_username
            `;
            
            // If userId is provided, add a field to show if user liked the post
            if (userId) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM likes 
                        WHERE post_id = p.id AND user_id = $3
                    )) as user_liked
                `;
            } else {
                query += `, false as user_liked`;
            }
            
            query += `
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.is_active = true
                AND p.group_id = $1
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const result = userId 
                ? await db.query(query, [groupId, limit, offset, userId])
                : await db.query(query, [groupId, limit, offset]);
                
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    // Get post by ID with like status
    static async findById(id, userId = null) {
        try {
            let query = `
                SELECT 
                    p.*,
                    CASE 
                        WHEN p.is_anonymous = true THEN 'Anonymous'
                        ELSE u.display_name
                    END as author_name,
                    CASE 
                        WHEN p.is_anonymous = true THEN NULL
                        ELSE u.username
                    END as author_username
            `;
            
            // Add user_liked field if userId provided
            if (userId) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM likes 
                        WHERE post_id = p.id AND user_id = $2
                    )) as user_liked
                `;
            } else {
                query += `, false as user_liked`;
            }
            
            query += `
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.id = $1 AND p.is_active = true
            `;
            
            const result = userId 
                ? await db.query(query, [id, userId])
                : await db.query(query, [id]);
            
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Get post with visibility check
    static async getWithVisibilityCheck(postId, userId = null) {
        try {
            const post = await this.findById(postId, userId);
            
            // If post doesn't exist, return null
            if (!post) return null;
            
            // If post is in a group, use group access rules
            if (post.group_id) {
                const groupQuery = `
                    SELECT privacy FROM groups WHERE id = $1
                `;
                const groupResult = await db.query(groupQuery, [post.group_id]);
                
                if (!groupResult.rows.length) return null; // Group doesn't exist
                
                const groupPrivacy = groupResult.rows[0].privacy;
                
                // If group is public, allow access to the post
                if (groupPrivacy === 'public') return post;
                
                // If no user is logged in, deny access to posts in private groups
                if (!userId) return null;
                
                // Check if user is a member of the group
                const memberQuery = `
                    SELECT EXISTS (
                        SELECT 1 FROM group_members
                        WHERE group_id = $1 AND user_id = $2 AND status = 'active'
                    ) as is_member
                `;
                const memberResult = await db.query(memberQuery, [post.group_id, userId]);
                
                if (memberResult.rows[0].is_member) {
                    return post; // User is a member, allow access
                }
                
                return null; // User is not a member of the private group
            }
            
            // If post is public, allow access
            if (post.visibility === 'public') return post;
            
            // If no user is logged in, deny access to non-public posts
            if (!userId) return null;
            
            // If user is the author, allow access
            if (post.user_id === parseInt(userId)) return post;
            
            // If post is private and user is not the author, deny access
            if (post.visibility === 'private') return null;
            
            // If post is friends-only, check friendship
            if (post.visibility === 'friends') {
                const friendshipQuery = `
                    SELECT EXISTS (
                        SELECT 1 FROM friendships
                        WHERE ((requester_id = $1 AND addressee_id = $2) OR
                              (requester_id = $2 AND addressee_id = $1))
                        AND status = 'accepted'
                    ) as is_friend
                `;
                const friendResult = await db.query(friendshipQuery, [userId, post.user_id]);
                
                if (friendResult.rows[0].is_friend) {
                    return post;
                }
                
                return null;
            }
            
            // Default - deny access
            return null;
        } catch (error) {
            throw error;
        }
    }

    // Get posts by user with visibility check
    static async getByUser(targetUserId, currentUserId = null, limit = 20, offset = 0) {
        try {
            let visibilityCondition;
            
            // Determine what posts should be visible
            if (!currentUserId) {
                // Anonymous viewers see only public posts
                visibilityCondition = "p.visibility = 'public'";
            } else if (parseInt(targetUserId) === parseInt(currentUserId)) {
                // Own profile - see all posts
                visibilityCondition = "1=1"; // Always true
            } else {
                // Check if users are friends
                const friendshipQuery = `
                    SELECT EXISTS (
                        SELECT 1 FROM friendships
                        WHERE ((requester_id = $1 AND addressee_id = $2) OR
                              (requester_id = $2 AND addressee_id = $1))
                        AND status = 'accepted'
                    ) as is_friend
                `;
                const friendResult = await db.query(friendshipQuery, [currentUserId, targetUserId]);
                
                if (friendResult.rows[0].is_friend) {
                    // Friends can see public and friends-only posts
                    visibilityCondition = "(p.visibility = 'public' OR p.visibility = 'friends')";
                } else {
                    // Non-friends can only see public posts
                    visibilityCondition = "p.visibility = 'public'";
                }
            }
            
            let query = `
                SELECT 
                    p.id, 
                    p.content,
                    p.is_anonymous, 
                    p.post_type,
                    p.likes_count,
                    p.comments_count,
                    p.created_at,
                    p.visibility,
                    CASE 
                        WHEN p.is_anonymous = true THEN 'Anonymous'
                        ELSE u.display_name
                    END as author_name,
                    CASE 
                        WHEN p.is_anonymous = true THEN NULL
                        ELSE u.username
                    END as author_username
            `;
            
            // Add user_liked field if currentUserId provided
            if (currentUserId) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM likes 
                        WHERE post_id = p.id AND user_id = $4
                    )) as user_liked
                `;
            } else {
                query += `, false as user_liked`;
            }
            
            query += `
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.user_id = $1 AND p.is_active = true AND ${visibilityCondition}
                AND p.group_id IS NULL
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const params = currentUserId 
                ? [targetUserId, limit, offset, currentUserId]
                : [targetUserId, limit, offset];
                
            const result = await db.query(query, params);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    // Get posts visible to user (public + friends-only from friends)
    static async getVisibleToUser(userId, limit = 20, offset = 0) {
        try {
            // Get user's friends
            const friendsQuery = `
                SELECT 
                    CASE
                        WHEN requester_id = $1 THEN addressee_id
                        ELSE requester_id
                    END as friend_id
                FROM friendships
                WHERE (requester_id = $1 OR addressee_id = $1)
                AND status = 'accepted'
            `;
            
            const friendsResult = await db.query(friendsQuery, [userId]);
            const friendIds = friendsResult.rows.map(row => row.friend_id);
            
            // Add user's own ID to see their own posts
            friendIds.push(parseInt(userId));
            
            // Get user's group memberships
            const groupsQuery = `
                SELECT group_id
                FROM group_members
                WHERE user_id = $1 AND status = 'active'
            `;
            
            const groupsResult = await db.query(groupsQuery, [userId]);
            const groupIds = groupsResult.rows.map(row => row.group_id);
            
            let postsQuery = `
                SELECT 
                    p.id, 
                    p.content,
                    p.is_anonymous, 
                    p.post_type,
                    p.group_id,
                    p.likes_count,
                    p.comments_count,
                    p.created_at,
                    p.visibility,
                    CASE 
                        WHEN p.is_anonymous = true THEN 'Anonymous'
                        ELSE u.display_name 
                    END as author_name,
                    CASE 
                        WHEN p.is_anonymous = true THEN NULL
                        ELSE u.username
                    END as author_username,
                    (SELECT EXISTS(
                        SELECT 1 FROM likes 
                        WHERE post_id = p.id AND user_id = $1
                    )) as user_liked,
                    g.name as group_name
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                LEFT JOIN groups g ON p.group_id = g.id
                WHERE p.is_active = true
                AND (
                    -- Regular posts visible to user
                    (p.group_id IS NULL AND (
                        p.visibility = 'public' 
                        OR (p.visibility = 'friends' AND p.user_id = ANY($2))
                        OR p.user_id = $1
                    ))
                    -- Posts from groups user is a member of
                    OR (p.group_id IS NOT NULL AND p.group_id = ANY($3))
                )
                ORDER BY p.created_at DESC
                LIMIT $4 OFFSET $5
            `;
            
            // Default empty array for group IDs if user isn't in any groups
            const safeGroupIds = groupIds.length > 0 ? groupIds : [0];
            
            const result = await db.query(postsQuery, [
                userId, 
                friendIds, 
                safeGroupIds,
                limit, 
                offset
            ]);
                
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    // Update post
    static async update(id, userId, { content, visibility }) {
        try {
            // Verify post ownership
            const post = await db.query('SELECT user_id FROM posts WHERE id = $1', [id]);
            
            if (post.rows.length === 0) {
                return null;
            }
            
            if (post.rows[0].user_id !== userId) {
                throw new Error('Unauthorized to update this post');
            }
            
            // Validate visibility if provided
            let updateFields = [];
            let params = [id];
            let paramCount = 2;
            
            if (content !== undefined) {
                updateFields.push(`content = $${paramCount++}`);
                params.push(content);
            }
            
            if (visibility !== undefined) {
                const validVisibility = ['public', 'friends', 'private'];
                if (!validVisibility.includes(visibility)) {
                    throw new Error('Invalid visibility option');
                }
                updateFields.push(`visibility = $${paramCount++}`);
                params.push(visibility);
            }
            
            // If nothing to update
            if (updateFields.length === 0) {
                return await this.findById(id);
            }
            
            const query = `
                UPDATE posts
                SET ${updateFields.join(', ')}
                WHERE id = $1
                RETURNING id, user_id, content, is_anonymous, post_type, visibility, likes_count, comments_count, created_at
            `;
            
            const result = await db.query(query, params);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Delete post (soft delete)
    static async delete(id, userId) {
        try {
            // Verify post ownership
            const post = await db.query('SELECT user_id FROM posts WHERE id = $1', [id]);
            
            if (post.rows.length === 0) {
                return { success: false, message: 'Post not found' };
            }
            
            if (post.rows[0].user_id !== userId) {
                return { success: false, message: 'Unauthorized to delete this post' };
            }
            
            // Soft delete
            const query = `
                UPDATE posts
                SET is_active = false
                WHERE id = $1
                RETURNING id
            `;
            
            const result = await db.query(query, [id]);
            return { success: true, message: 'Post deleted successfully' };
        } catch (error) {
            throw error;
        }
    }

    // Get post with user like status
    static async getWithUserLikeStatus(postId, userId) {
        try {
            // First get the post
            const post = await this.getWithVisibilityCheck(postId, userId);
            
            if (!post) return null;
            
            // If no userId provided, return post without like status
            if (!userId) return { ...post, userLiked: false };
            
            // Check if user liked this post
            const query = 'SELECT id FROM likes WHERE post_id = $1 AND user_id = $2';
            const result = await db.query(query, [postId, userId]);
            
            return {
                ...post,
                userLiked: result.rows.length > 0
            };
        } catch (error) {
            throw error;
        }
    }

    // Create new post with media
static async createWithMedia({ userId, content, mediaIds = [], isAnonymous = false, visibility = 'public' }) {
  try {
    // Start transaction
    await db.query('BEGIN');
    
    // Create the post first
    const post = await this.create({ userId, content, isAnonymous, postType: 'media', visibility });
    
    // Associate media with post
    if (mediaIds.length > 0) {
      for (let i = 0; i < mediaIds.length; i++) {
        await db.query(
          `INSERT INTO post_media (post_id, media_id, position) VALUES ($1, $2, $3)`,
          [post.id, mediaIds[i], i]
        );
      }
    }
    
    // Commit transaction
    await db.query('COMMIT');
    
    // Return post with media
    return await this.findById(post.id, userId);
  } catch (error) {
    // Rollback on error
    await db.query('ROLLBACK');
    throw error;
  }
}

// Get media for a post
static async getMedia(postId) {
  try {
    const query = `
      SELECT m.* FROM media m
      JOIN post_media pm ON m.id = pm.media_id
      WHERE pm.post_id = $1 AND m.is_deleted = false
      ORDER BY pm.position ASC
    `;
    
    const result = await db.query(query, [postId]);
    
    return result.rows.map(media => ({
      ...media,
      variants: typeof media.variants === 'string' ? JSON.parse(media.variants) : media.variants,
      metadata: typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata
    }));
  } catch (error) {
    throw error;
  }
}
}

module.exports = Post;