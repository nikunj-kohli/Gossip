const db = require('../config/database');
const crypto = require('crypto');

class Post {
    static slugifyHeadline(text = '') {
        const base = String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');

        return (base || 'post').slice(0, 60);
    }

    static formatDateToken(dateInput) {
        const d = new Date(dateInput);
        if (Number.isNaN(d.getTime())) return '01011970';

        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = String(d.getFullYear());
        return `${dd}${mm}${yyyy}`;
    }

    static encodePostToken(postId, createdAt) {
        const ts = new Date(createdAt).getTime();
        const payload = `${postId}:${Number.isNaN(ts) ? 0 : ts}`;
        return Buffer.from(payload).toString('base64url');
    }

    static decodePostToken(token) {
        try {
            const decoded = Buffer.from(token, 'base64url').toString('utf8');
            const [idRaw, tsRaw] = decoded.split(':');
            const id = parseInt(idRaw, 10);
            const ts = parseInt(tsRaw, 10);
            if (!id || Number.isNaN(ts)) return null;
            return { id, ts };
        } catch (e) {
            return null;
        }
    }

    static buildPermalinkFromRow(row) {
        if (!row || !row.id || !row.created_at) return null;
        const headline = this.slugifyHeadline(row.content || 'post');
        const dateToken = this.formatDateToken(row.created_at);
        const token = this.encodePostToken(row.id, row.created_at);

        if (row.group_slug || row.group_name || row.group_id) {
            const communitySegment = row.group_slug
                || this.slugifyHeadline(row.group_name || 'community')
                || String(row.group_id);
            return `/c/${communitySegment}/${headline}/${dateToken}-${token}`;
        }

        return `/p/${headline}/${dateToken}-${token}`;
    }

    static async getFeedPreferences(userId) {
        const defaults = {
            pulse_ratio: 0.5,
            tribes_ratio: 0.3,
            discover_ratio: 0.2,
        };

        try {
            const result = await db.query(
                `
                    SELECT pulse_ratio, tribes_ratio, discover_ratio
                    FROM user_feed_preferences
                    WHERE user_id = $1
                `,
                [userId]
            );

            if (!result.rows.length) {
                return defaults;
            }

            return {
                pulse_ratio: Number(result.rows[0].pulse_ratio),
                tribes_ratio: Number(result.rows[0].tribes_ratio),
                discover_ratio: Number(result.rows[0].discover_ratio),
            };
        } catch (error) {
            return defaults;
        }
    }

    static async upsertFeedPreferences(userId, prefs = {}) {
        const pulse = Number(prefs.pulse_ratio);
        const tribes = Number(prefs.tribes_ratio);
        const discover = Number(prefs.discover_ratio);

        const fallback = await this.getFeedPreferences(userId);

        const normalized = {
            pulse_ratio: Number.isFinite(pulse) ? Math.max(0, Math.min(1, pulse)) : fallback.pulse_ratio,
            tribes_ratio: Number.isFinite(tribes) ? Math.max(0, Math.min(1, tribes)) : fallback.tribes_ratio,
            discover_ratio: Number.isFinite(discover) ? Math.max(0, Math.min(1, discover)) : fallback.discover_ratio,
        };

        const sum = normalized.pulse_ratio + normalized.tribes_ratio + normalized.discover_ratio;
        if (sum > 0) {
            normalized.pulse_ratio = normalized.pulse_ratio / sum;
            normalized.tribes_ratio = normalized.tribes_ratio / sum;
            normalized.discover_ratio = normalized.discover_ratio / sum;
        }

        try {
            const result = await db.query(
                `
                    INSERT INTO user_feed_preferences (user_id, pulse_ratio, tribes_ratio, discover_ratio)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id)
                    DO UPDATE SET
                        pulse_ratio = EXCLUDED.pulse_ratio,
                        tribes_ratio = EXCLUDED.tribes_ratio,
                        discover_ratio = EXCLUDED.discover_ratio,
                        updated_at = NOW()
                    RETURNING user_id, pulse_ratio, tribes_ratio, discover_ratio
                `,
                [userId, normalized.pulse_ratio, normalized.tribes_ratio, normalized.discover_ratio]
            );

            return result.rows[0];
        } catch (error) {
            return normalized;
        }
    }

    static async markPostNotInterested(userId, postId) {
        try {
            await db.query(
                `
                    INSERT INTO user_post_feedback (user_id, post_id, feedback_type)
                    VALUES ($1, $2, 'not_interested')
                    ON CONFLICT (user_id, post_id)
                    DO UPDATE SET feedback_type = 'not_interested', updated_at = NOW()
                `,
                [userId, postId]
            );

            return { success: true };
        } catch (error) {
            return { success: true };
        }
    }

    static applyAnonymityLabels(rows) {
        if (!Array.isArray(rows)) return [];

        return rows.map((row) => {
            if (!row) return row;

            const withPermalink = {
                ...row,
                permalink: this.buildPermalinkFromRow(row),
            };

            if (!row.is_anonymous) return withPermalink;

            if (row.group_id) {
                const mask = crypto
                    .createHash('sha1')
                    .update(`${row.user_id || 'u'}:${row.group_id}`)
                    .digest('hex')
                    .slice(0, 6)
                    .toUpperCase();

                return {
                    ...withPermalink,
                    author_name: `Mask-${mask}`,
                    author_username: null,
                };
            }

            return {
                ...withPermalink,
                author_name: 'Anonymous',
                author_username: null,
            };
        });
    }

    static async getModerationContext(postId, userId) {
        const query = `
            SELECT
                p.id,
                p.user_id,
                p.group_id,
                g.creator_id,
                gm.role as requester_role
            FROM posts p
            LEFT JOIN groups g ON g.id = p.group_id
            LEFT JOIN group_members gm
                ON gm.group_id = p.group_id
                AND gm.user_id = $2
                AND gm.is_banned = FALSE
            WHERE p.id = $1
        `;

        const result = await db.query(query, [postId, userId]);
        return result.rows[0] || null;
    }

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
            return this.applyAnonymityLabels(result.rows)[0];
        } catch (error) {
            throw error;
        }
    }

    // Create post in a group
    static async createInGroup({ userId, groupId, content, isAnonymous = false, postType = 'text' }) {
        try {
            // Use a single query with JOIN instead of two separate queries (N+1 fix)
            const query = `
                WITH new_post AS (
                    INSERT INTO posts (user_id, group_id, content, is_anonymous, post_type, visibility)
                    VALUES ($1, $2, $3, $4, $5, 'public')
                    RETURNING id, user_id, group_id, content, is_anonymous, post_type, visibility, likes_count, comments_count, created_at
                )
                SELECT 
                    np.id, np.user_id, np.group_id, np.content, np.is_anonymous, np.post_type,
                    np.visibility, np.likes_count, np.comments_count, np.created_at,
                    g.slug as group_slug
                FROM new_post np
                LEFT JOIN groups g ON np.group_id = g.id
            `;
            
            const result = await db.query(query, [userId, groupId, content, isAnonymous, postType]);
            const rows = result.rows;
            if (!rows.length) return null;

            return this.applyAnonymityLabels(rows)[0];
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
                
            return this.applyAnonymityLabels(result.rows);
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
                    p.user_id,
                    p.content,
                    p.is_anonymous, 
                    p.post_type,
                    p.group_id,
                    p.likes_count,
                    p.comments_count,
                    p.created_at,
                    p.visibility,
                    g.name as group_name,
                    g.slug as group_slug,
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
                        WHERE post_id = p.id AND user_id = $4
                    )) as user_liked
                `;
            } else {
                query += `, false as user_liked`;
            }
            
            query += `
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                LEFT JOIN groups g ON p.group_id = g.id
                WHERE p.is_active = true
                AND p.group_id = $1
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const result = userId 
                ? await db.query(query, [groupId, limit, offset, userId])
                : await db.query(query, [groupId, limit, offset]);
                
            return this.applyAnonymityLabels(result.rows);
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
                    g.name as group_name,
                    g.slug as group_slug,
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
                LEFT JOIN groups g ON p.group_id = g.id
                WHERE p.id = $1 AND p.is_active = true
            `;
            
            const result = userId 
                ? await db.query(query, [id, userId])
                : await db.query(query, [id]);
            
            const normalizedRows = this.applyAnonymityLabels(result.rows);
            return normalizedRows[0];
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
            const isOwnerView = parseInt(targetUserId, 10) === parseInt(currentUserId, 10);

            if (!currentUserId) {
                // Profile content requires friendship when not viewing your own profile.
                return [];
            }

            if (isOwnerView) {
                // Own profile: see all personal posts including anonymous.
                visibilityCondition = '1=1';
            } else {
                const friendshipQuery = `
                    SELECT EXISTS (
                        SELECT 1 FROM friendships
                        WHERE ((requester_id = $1 AND addressee_id = $2) OR
                              (requester_id = $2 AND addressee_id = $1))
                        AND status = 'accepted'
                    ) as is_friend
                `;
                const friendResult = await db.query(friendshipQuery, [currentUserId, targetUserId]);
                if (!friendResult.rows[0]?.is_friend) {
                    return [];
                }

                // Friends can see non-anonymous personal posts.
                visibilityCondition = 'p.is_anonymous = false';
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
                    p.group_id,
                    g.name as group_name,
                    g.slug as group_slug,
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
                LEFT JOIN groups g ON p.group_id = g.id
                WHERE p.user_id = $1 AND p.is_active = true AND ${visibilityCondition}
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const params = currentUserId 
                ? [targetUserId, limit, offset, currentUserId]
                : [targetUserId, limit, offset];
                
            const result = await db.query(query, params);
            return this.applyAnonymityLabels(result.rows);
        } catch (error) {
            throw error;
        }
    }

    static async findByPermalink({ communitySlug = null, headline = null, dateToken = null, token = null, userId = null }) {
        try {
            const decoded = this.decodePostToken(token || '');
            if (!decoded) return null;

            const post = await this.findById(decoded.id, userId);
            if (!post) return null;

            // Be tolerant with headline/date tokens so old/shared links still resolve
            // after edits or timezone differences. Token already resolves the post id.
            const expectedHeadline = this.slugifyHeadline(post.content || 'post');
            const expectedDate = this.formatDateToken(post.created_at);
            const canonicalPermalink = this.buildPermalinkFromRow(post);

            if (communitySlug) {
                if (!post.group_id) return null;
                const groupRow = await db.query('SELECT slug, name FROM groups WHERE id = $1', [post.group_id]);
                const slug = groupRow.rows[0]?.slug || String(post.group_id);
                const nameSlug = this.slugifyHeadline(groupRow.rows[0]?.name || 'community');
                if (slug !== communitySlug && nameSlug !== communitySlug && String(post.group_id) !== communitySlug) {
                    return null;
                }
                post.group_slug = slug;
            }

            const resolved = this.applyAnonymityLabels([post])[0];
            return {
                ...resolved,
                canonical_permalink: canonicalPermalink,
                permalink_mismatch: Boolean(
                    (headline && headline !== expectedHeadline) ||
                    (dateToken && dateToken !== expectedDate)
                ),
            };
        } catch (error) {
            throw error;
        }
    }

    static async registerShare(postId, userId = null) {
        try {
            await db.query('BEGIN');

            try {
                if (userId) {
                    await db.query(
                        'INSERT INTO post_shares (post_id, user_id) VALUES ($1, $2)',
                        [postId, userId]
                    );
                } else {
                    await db.query(
                        'INSERT INTO post_shares (post_id) VALUES ($1)',
                        [postId]
                    );
                }
            } catch (shareTableError) {
                // Backward compatible if post_shares table is not migrated yet.
            }

            let shareCount = null;
            try {
                const updateResult = await db.query(
                    'UPDATE posts SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = $1 RETURNING shares_count',
                    [postId]
                );
                shareCount = updateResult.rows[0]?.shares_count ?? null;
            } catch (columnError) {
                // Backward compatible if shares_count column is not migrated yet.
            }

            await db.query('COMMIT');
            return { shareCount };
        } catch (error) {
            try {
                await db.query('ROLLBACK');
            } catch (rollbackError) {
                // ignore rollback failure
            }
            throw error;
        }
    }

    // Get posts visible to user (public + friends-only from friends)
    static async getVisibleToUser(userId, limit = 20, offset = 0) {
        try {
            console.log('getVisibleToUser called for userId:', userId, 'limit:', limit, 'offset:', offset);
            
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
            
            let friendIds = [parseInt(userId)]; // Default to just user's own posts
            let groupIds = []; // Default to empty
            
            try {
                const friendsResult = await db.query(friendsQuery, [userId]);
                friendIds = friendsResult.rows.map(row => row.friend_id);
                friendIds.push(parseInt(userId)); // Add user's own ID
            } catch (friendError) {
                console.error('Error fetching friends, using empty array:', friendError.message);
                // friendIds already contains just user's ID
            }
            
            // Get user's group memberships
            const groupsQuery = `
                SELECT group_id
                FROM group_members
                WHERE user_id = $1 AND status = 'active'
            `;
            
            try {
                const groupsResult = await db.query(groupsQuery, [userId]);
                groupIds = groupsResult.rows.map(row => row.group_id);
            } catch (groupError) {
                console.error('Error fetching groups, using empty array:', groupError.message);
                // groupIds already empty
            }
            
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
            
            console.log('getVisibleToUser returning', result.rows.length, 'posts');
            return this.applyAnonymityLabels(result.rows);
        } catch (error) {
            throw error;
        }
    }

    static async getRandomPublicGroupPosts(userId = null, limit = 6) {
        try {
            const safeLimit = Number.isInteger(limit) ? limit : parseInt(limit, 10);
            const finalLimit = Number.isNaN(safeLimit) ? 6 : Math.max(1, Math.min(safeLimit, 30));

            let query = `
                SELECT
                    p.id,
                    p.user_id,
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
                    g.name as group_name,
                    g.slug as group_slug
            `;

            if (userId) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM likes
                        WHERE post_id = p.id AND user_id = $1
                    )) as user_liked
                `;
            } else {
                query += `, false as user_liked`;
            }

            query += `
                FROM posts p
                JOIN groups g ON g.id = p.group_id
                LEFT JOIN users u ON u.id = p.user_id
                WHERE p.is_active = true
                AND p.group_id IS NOT NULL
                AND g.is_active = true
                AND g.privacy = 'public'
                ORDER BY RANDOM()
            `;

            if (userId) {
                query += ` LIMIT $2`;
                const result = await db.query(query, [userId, finalLimit]);
                return this.applyAnonymityLabels(result.rows);
            }

            query += ` LIMIT $1`;
            const result = await db.query(query, [finalLimit]);
            return this.applyAnonymityLabels(result.rows);
        } catch (error) {
            throw error;
        }
    }

    static async getPulseFeedForUser(userId, limit = 20, offset = 0) {
        try {
            const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
            const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

            const query = `
                SELECT
                    p.id,
                    p.user_id,
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
                    'pulse'::text as source_scope,
                    NULL::text as group_name,
                    NULL::text as group_slug
                FROM posts p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.is_active = true
                AND p.group_id IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM user_post_feedback upf
                    WHERE upf.user_id = $1
                    AND upf.post_id = p.id
                    AND upf.feedback_type = 'not_interested'
                )
                AND (
                    p.visibility = 'public'
                    OR (p.visibility = 'friends' AND EXISTS (
                        SELECT 1 FROM friendships f
                        WHERE ((f.requester_id = $1 AND f.addressee_id = p.user_id)
                            OR (f.requester_id = p.user_id AND f.addressee_id = $1))
                        AND f.status = 'accepted'
                    ))
                    OR p.user_id = $1
                )
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, safeLimit, safeOffset]);
            return this.applyAnonymityLabels(result.rows);
        } catch (error) {
            throw error;
        }
    }

    static async getCommunityPostsForUser(userId, limit = 20, offset = 0) {
        try {
            const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
            const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

            const query = `
                SELECT
                    p.id,
                    p.user_id,
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
                    'community'::text as source_scope,
                    g.name as group_name,
                    g.slug as group_slug
                FROM posts p
                JOIN groups g ON g.id = p.group_id
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.is_active = true
                AND p.group_id IS NOT NULL
                AND g.is_active = true
                AND NOT EXISTS (
                    SELECT 1 FROM user_post_feedback upf
                    WHERE upf.user_id = $1
                    AND upf.post_id = p.id
                    AND upf.feedback_type = 'not_interested'
                )
                AND EXISTS (
                    SELECT 1 FROM group_members gm
                    WHERE gm.group_id = p.group_id
                    AND gm.user_id = $1
                    AND gm.is_banned = false
                )
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, safeLimit, safeOffset]);
            return this.applyAnonymityLabels(result.rows);
        } catch (error) {
            throw error;
        }
    }

    static async getSuggestedCommunityPosts(userId, limit = 20, offset = 0) {
        try {
            const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
            const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

            const query = `
                WITH user_joined_groups AS (
                    SELECT gm.group_id
                    FROM group_members gm
                    WHERE gm.user_id = $1
                    AND gm.is_banned = false
                ),
                interest_groups AS (
                    SELECT p.group_id, COUNT(*)::int as score
                    FROM likes l
                    JOIN posts p ON p.id = l.post_id
                    WHERE l.user_id = $1
                    AND p.group_id IS NOT NULL
                    GROUP BY p.group_id
                    UNION ALL
                    SELECT p.group_id, COUNT(*)::int as score
                    FROM posts p
                    WHERE p.user_id = $1
                    AND p.group_id IS NOT NULL
                    GROUP BY p.group_id
                ),
                aggregated_interest AS (
                    SELECT group_id, SUM(score)::int as score
                    FROM interest_groups
                    GROUP BY group_id
                )
                SELECT
                    p.id,
                    p.user_id,
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
                    'suggested_community'::text as source_scope,
                    g.name as group_name,
                    g.slug as group_slug
                FROM posts p
                JOIN groups g ON g.id = p.group_id
                LEFT JOIN users u ON p.user_id = u.id
                LEFT JOIN aggregated_interest ai ON ai.group_id = p.group_id
                LEFT JOIN (
                    SELECT entity_id AS post_id, COUNT(*)::int AS pending_report_count
                    FROM reports
                    WHERE entity_type = 'post'
                    AND status IN ('pending', 'reviewed')
                    GROUP BY entity_id
                ) report_stats ON report_stats.post_id = p.id
                WHERE p.is_active = true
                AND p.group_id IS NOT NULL
                AND g.is_active = true
                AND g.privacy = 'public'
                AND NOT EXISTS (
                    SELECT 1 FROM user_post_feedback upf
                    WHERE upf.user_id = $1
                    AND upf.post_id = p.id
                    AND upf.feedback_type = 'not_interested'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM user_joined_groups uj
                    WHERE uj.group_id = p.group_id
                )
                ORDER BY
                    COALESCE(ai.score, 0) DESC,
                    (
                        (p.likes_count * 0.3 + p.comments_count * 0.2)
                        - (COALESCE(report_stats.pending_report_count, 0) * 0.8)
                        - (CASE WHEN p.moderation_status IN ('flagged', 'hidden') THEN 3 ELSE 0 END)
                    ) DESC,
                    p.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, safeLimit, safeOffset]);
            return this.applyAnonymityLabels(result.rows);
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
            const context = await this.getModerationContext(id, userId);

            if (!context) {
                return { success: false, message: 'Post not found' };
            }

            const requesterRole = context.requester_role;
            const canModerateGroupPost = Boolean(context.group_id)
                && (
                    parseInt(context.creator_id) === parseInt(userId)
                    || requesterRole === 'admin'
                    || requesterRole === 'moderator'
                );

            const isOwner = parseInt(context.user_id) === parseInt(userId);

            if (!isOwner && !canModerateGroupPost) {
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

    static async warnInCommunity(postId, moderatorId, reason = null) {
        let transactionStarted = false;
        try {
            const context = await this.getModerationContext(postId, moderatorId);

            if (!context) {
                throw new Error('Post not found');
            }

            if (!context.group_id) {
                throw new Error('Only community posts can be warned by community moderators');
            }

            const requesterRole = context.requester_role;
            const canWarn = parseInt(context.creator_id) === parseInt(moderatorId)
                || requesterRole === 'admin'
                || requesterRole === 'moderator';

            if (!canWarn) {
                throw new Error('Unauthorized to warn this post');
            }

            if (parseInt(context.user_id) === parseInt(moderatorId)) {
                throw new Error('You cannot warn your own post');
            }

            await db.query('BEGIN');
            transactionStarted = true;

            await db.query(
                `
                    UPDATE posts
                    SET moderation_status = 'flagged'
                    WHERE id = $1
                `,
                [postId]
            );

            await db.query(
                `
                    UPDATE users
                    SET warning_count = warning_count + 1,
                        moderation_status = 'warned'
                    WHERE id = $1
                `,
                [context.user_id]
            );

            const actionResult = await db.query(
                `
                    INSERT INTO moderation_actions (
                        moderator_id,
                        entity_type,
                        entity_id,
                        action,
                        reason
                    )
                    VALUES ($1, 'post', $2, 'warn', $3)
                    RETURNING *
                `,
                [moderatorId, postId, reason]
            );

            await db.query('COMMIT');
            transactionStarted = false;

            return {
                action: actionResult.rows[0],
                warnedUserId: context.user_id
            };
        } catch (error) {
            if (transactionStarted) {
                await db.query('ROLLBACK');
            }
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