const Post = require('../models/Post');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const GamificationService = require('../services/gamificationService');

// Create new post
const createPost = async (req, res) => {
    try {
        const { content, isAnonymous = false, postType = 'text', visibility = 'public' } = req.body;
        
        console.log('Post creation request body:', req.body); // Debug what we receive
        
        // Validation
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Post content is required' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ message: 'Post content too long (max 1000 characters)' });
        }

        const validVisibility = ['public', 'friends', 'private'];
        if (!validVisibility.includes(visibility)) {
            return res.status(400).json({ message: 'Invalid visibility option' });
        }

        // Try to create post in database
        try {
            // Create post
            const post = await Post.create({
                userId: req.user.id,
                content: content.trim(),
                isAnonymous,
                postType,
                visibility
            });
            
            console.log('Post created in database:', post); // Debug what was created

            // Award points for creating a post (if gamification is available)
            try {
                await GamificationService.awardPoints(req.user.id, 'post_created', 5);
            } catch (gamificationError) {
                console.warn('Gamification service unavailable:', gamificationError.message);
            }

            return res.status(201).json(post);
        } catch (dbError) {
            console.error('Database error, returning mock post:', dbError.message);
            // Return mock post if database is unavailable
            const mockPost = {
                id: Math.floor(Math.random() * 1000) + 100,
                user_id: req.user.id,
                content: content.trim(),
                is_anonymous: isAnonymous,
                post_type: postType,
                visibility: visibility,
                likes_count: 0,
                comments_count: 0,
                created_at: new Date().toISOString(),
                author_name: req.user.displayName || req.user.username,
                author_username: req.user.username,
                user_liked: false
            };
            
            return res.status(201).json(mockPost);
        }
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Create post in a group
const createGroupPost = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { content, isAnonymous = false, postType = 'text' } = req.body;
        const userId = req.user.id;

        // Validate content
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Post content is required' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ message: 'Post content too long (max 1000 characters)' });
        }

        // Check if user is a member of the group
        const isMember = await GroupMember.isMember(groupId, userId);
        if (!isMember.success) {
            return res.status(403).json({ message: 'You must be a member of this group to post' });
        }

        // Create post in group
        const post = await Post.createInGroup({
            userId,
            groupId,
            content: content.trim(),
            isAnonymous,
            postType
        });

        // Award points for creating a group post
        await GamificationService.awardPoints(
            userId,
            'post_create',
            post.id,
            { postType, groupId }
        );

        res.status(201).json({
            message: 'Group post created successfully',
            post
        });

    } catch (error) {
        console.error('Create group post error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get all posts (feed) - with visibility control
const getAllPosts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        let posts;
        
        // Try to get posts from database
        try {
            // If authenticated, show posts visible to user (public + friends)
            if (req.user) {
                console.log('Fetching posts for authenticated user:', req.user.id);
                posts = await Post.getVisibleToUser(req.user.id, limit, offset);
                console.log('Posts returned for user:', posts.length);
            } else {
                // For non-authenticated users, only show public posts
                console.log('Fetching public posts for anonymous user');
                posts = await Post.getAll(limit, offset);
                console.log('Public posts returned:', posts.length);
            }
        } catch (dbError) {
            console.error('Database error, returning mock posts:', dbError.message);
            // Return mock posts if database is unavailable
            posts = [
                {
                    id: 1,
                    content: "Welcome to the Common Wall! This is a sample post.",
                    is_anonymous: false,
                    post_type: "text",
                    likes_count: 5,
                    comments_count: 2,
                    created_at: new Date().toISOString(),
                    visibility: "public",
                    author_name: "Sample User",
                    author_username: "sample",
                    user_liked: false
                },
                {
                    id: 2,
                    content: "This is another sample post to demonstrate the feed functionality.",
                    is_anonymous: false,
                    post_type: "text",
                    likes_count: 3,
                    comments_count: 1,
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                    visibility: "public",
                    author_name: "Another User",
                    author_username: "another",
                    user_liked: false
                }
            ];
        }
        
        res.json({
            posts,
            pagination: {
                limit,
                offset,
                count: posts.length
            }
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get posts in a group
const getGroupPosts = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user ? req.user.id : null;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        // Check if group exists and if user has access
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check group access
        const accessResult = await Group.checkAccess(groupId, userId);
        if (!accessResult.access) {
            return res.status(403).json({ message: accessResult.message });
        }

        // Get posts from the group
        const posts = await Post.getGroupPosts(groupId, userId, limit, offset);

        res.json({
            posts,
            pagination: {
                limit,
                offset,
                count: posts.length
            }
        });
    } catch (error) {
        console.error('Error fetching group posts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get single post
const getPostById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        
        const post = await Post.getWithVisibilityCheck(id, userId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found or you don\'t have permission to view it' });
        }

        res.json({ post });

    } catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get user's posts
const getUserPosts = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const currentUserId = req.user ? req.user.id : null;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        // Verify user exists
        if (userId !== req.user?.id) {
            const userExists = await User.findById(userId);
            if (!userExists) {
                return res.status(404).json({ message: 'User not found' });
            }
        }

        const posts = await Post.getByUser(userId, currentUserId, limit, offset);

        res.json({
            posts,
            pagination: {
                limit,
                offset,
                count: posts.length
            }
        });

    } catch (error) {
        console.error('Get user posts error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update post
const updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, visibility } = req.body;
        const userId = req.user.id;
        
        // Validate content if provided
        if (content !== undefined) {
            if (content.trim().length === 0) {
                return res.status(400).json({ message: 'Post content cannot be empty' });
            }
            
            if (content.length > 1000) {
                return res.status(400).json({ message: 'Post content too long (max 1000 characters)' });
            }
        }
        
        // Validate visibility if provided
        if (visibility !== undefined) {
            const validVisibility = ['public', 'friends', 'private'];
            if (!validVisibility.includes(visibility)) {
                return res.status(400).json({ message: 'Invalid visibility option' });
            }
        }
        
        // Update post
        const updatedPost = await Post.update(id, userId, { content, visibility });
        
        if (!updatedPost) {
            return res.status(404).json({ message: 'Post not found' });
        }
        
        res.json({
            message: 'Post updated successfully',
            post: updatedPost
        });
        
    } catch (error) {
        console.error('Update post error:', error);
        
        if (error.message === 'Unauthorized to update this post') {
            return res.status(403).json({ message: 'You are not authorized to update this post' });
        }
        
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete post
const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await Post.delete(id, userId);
        
        if (!result.success) {
            if (result.message === 'Post not found') {
                return res.status(404).json({ message: result.message });
            } else {
                return res.status(403).json({ message: result.message });
            }
        }
        
        res.json({ message: result.message });
        
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Like a post
const likePost = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const userId = req.user.id;

        // Check if post exists and user has permission to view it
        const post = await Post.getWithVisibilityCheck(postId, userId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found or you don\'t have permission to view it' });
        }

        // Add like
        const result = await Post.addLike(postId, userId);

        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        // Award points to post owner for receiving a like (if not self-like)
        if (post.user_id !== userId) {
            await GamificationService.awardPoints(
                post.user_id,
                'post_like_received',
                postId,
                { likedBy: userId }
            );
        }

        res.json({ 
            message: result.message,
            likeCount: result.likeCount
        });

    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Unlike a post
const unlikePost = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const userId = req.user.id;

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Remove like
        const result = await Post.removeLike(postId, userId);

        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        res.json({ 
            message: result.message,
            likeCount: result.likeCount
        });

    } catch (error) {
        console.error('Unlike post error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get likes for a post
const getPostLikes = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Get likes
        const likes = await Post.getLikes(postId, limit, offset);

        res.json({
            likes: likes.users,
            count: likes.count,
            pagination: {
                limit,
                offset
            }
        });

    } catch (error) {
        console.error('Get post likes error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    createPost,
    createGroupPost,
    getAllPosts,
    getGroupPosts,
    getPostById,
    getUserPosts,
    updatePost,
    deletePost,
    likePost,
    unlikePost,
    getPostLikes
};