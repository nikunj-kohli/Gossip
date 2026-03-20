-- Gossip Social Media Application - Complete Database Schema
-- PostgreSQL Schema for Supabase

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for enums
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
    CREATE TYPE post_visibility AS ENUM ('public', 'friends', 'private');
    CREATE TYPE post_type AS ENUM ('text', 'media', 'poll', 'link');
    CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');
    CREATE TYPE group_privacy AS ENUM ('public', 'private');
    CREATE TYPE group_role AS ENUM ('admin', 'moderator', 'member');
    CREATE TYPE notification_type AS ENUM ('like', 'comment', 'friend_request', 'friend_accepted', 'post_mention', 'comment_mention', 'group_invite', 'group_post');
    CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document');
    CREATE TYPE notification_status AS ENUM ('enabled', 'disabled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    status user_status DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for users table
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_display_name ON users(display_name);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- POSTS TABLE
-- ============================================
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    post_type post_type DEFAULT 'text',
    visibility post_visibility DEFAULT 'public',
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for posts table
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_group_id ON posts(group_id);
CREATE INDEX idx_posts_visibility ON posts(visibility);
CREATE INDEX idx_posts_is_active ON posts(is_active);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_content_search ON posts USING gin(to_tsvector('english', content));

-- ============================================
-- COMMENTS TABLE
-- ============================================
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for comments table
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- ============================================
-- LIKES TABLE
-- ============================================
CREATE TABLE likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

-- Add indexes for likes table
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_created_at ON likes(created_at DESC);

-- ============================================
-- COMMENT LIKES TABLE
-- ============================================
CREATE TABLE comment_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, comment_id)
);

-- Add indexes for comment likes
CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_id ON comment_likes(user_id);

-- ============================================
-- FRIENDSHIPS TABLE
-- ============================================
CREATE TABLE friendships (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status friendship_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (requester_id != addressee_id),
    UNIQUE(requester_id, addressee_id)
);

-- Add indexes for friendships table
CREATE INDEX idx_friendships_requester_id ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee_id ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_friendships_created_at ON friendships(created_at DESC);

-- ============================================
-- GROUPS TABLE
-- ============================================
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    description TEXT,
    privacy group_privacy DEFAULT 'public',
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    avatar_url VARCHAR(500),
    cover_url VARCHAR(500),
    member_count INTEGER DEFAULT 1,
    post_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for groups table
CREATE INDEX idx_groups_creator_id ON groups(creator_id);
CREATE INDEX idx_groups_slug ON groups(slug);
CREATE INDEX idx_groups_privacy ON groups(privacy);
CREATE INDEX idx_groups_is_active ON groups(is_active);
CREATE INDEX idx_groups_name_search ON groups USING gin(to_tsvector('english', name));
CREATE INDEX idx_groups_created_at ON groups(created_at DESC);

-- ============================================
-- GROUP MEMBERS TABLE
-- ============================================
CREATE TABLE group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role group_role DEFAULT 'member',
    is_banned BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- Add indexes for group members table
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_role ON group_members(role);
CREATE INDEX idx_group_members_is_banned ON group_members(is_banned);

-- ============================================
-- MEDIA TABLE
-- ============================================
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NOT NULL,
    type media_type NOT NULL,
    width INTEGER,
    height INTEGER,
    size INTEGER,
    variants JSONB,
    alt TEXT,
    metadata JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for media table
CREATE INDEX idx_media_user_id ON media(user_id);
CREATE INDEX idx_media_public_id ON media(public_id);
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_is_deleted ON media(is_deleted);
CREATE INDEX idx_media_created_at ON media(created_at DESC);

-- ============================================
-- POST MEDIA RELATIONSHIP TABLE
-- ============================================
CREATE TABLE post_media (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(post_id, media_id)
);

-- Add indexes for post media table
CREATE INDEX idx_post_media_post_id ON post_media(post_id);
CREATE INDEX idx_post_media_media_id ON post_media(media_id);
CREATE INDEX idx_post_media_position ON post_media(position);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type notification_type NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for notifications table
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_actor_id ON notifications(actor_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================
CREATE TABLE notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    status notification_status DEFAULT 'enabled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, notification_type)
);

-- Add indexes for notification preferences
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_type ON notification_preferences(notification_type);

-- ============================================
-- CONVERSATIONS TABLE (for messaging)
-- ============================================
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_id INTEGER,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (user1_id < user2_id), -- Ensures consistent ordering
    UNIQUE(user1_id, user2_id)
);

-- Add indexes for conversations
CREATE INDEX idx_conversations_user1_id ON conversations(user1_id);
CREATE INDEX idx_conversations_user2_id ON conversations(user2_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    message_type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for messages table
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- CHAT ROOMS TABLE (for group chat)
-- ============================================
CREATE TABLE chat_rooms (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for chat rooms
CREATE INDEX idx_chat_rooms_group_id ON chat_rooms(group_id);
CREATE INDEX idx_chat_rooms_is_active ON chat_rooms(is_active);

-- ============================================
-- CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    chat_room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for chat messages
CREATE INDEX idx_chat_messages_chat_room_id ON chat_messages(chat_room_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_is_deleted ON chat_messages(is_deleted);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- ============================================
-- POST VIEWS TABLE (for view tracking)
-- ============================================
CREATE TABLE post_views (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Add indexes for post views
CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_views_user_id ON post_views(user_id);
CREATE INDEX idx_post_views_viewed_at ON post_views(viewed_at DESC);

-- ============================================
-- REPORTS TABLE (for moderation)
-- ============================================
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_entity_type VARCHAR(50) NOT NULL,
    reported_entity_id INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for reports table
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_entity ON reports(reported_entity_type, reported_entity_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- ============================================
-- MODERATION LOG TABLE
-- ============================================
CREATE TABLE moderation_log (
    id SERIAL PRIMARY KEY,
    moderator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INTEGER NOT NULL,
    reason TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for moderation log
CREATE INDEX idx_moderation_log_moderator_id ON moderation_log(moderator_id);
CREATE INDEX idx_moderation_log_target ON moderation_log(target_type, target_id);
CREATE INDEX idx_moderation_log_created_at ON moderation_log(created_at DESC);

-- ============================================
-- GAMIFICATION TABLES
-- ============================================

-- POINTS TABLE
CREATE TABLE points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for points
CREATE INDEX idx_points_user_id ON points(user_id);
CREATE INDEX idx_points_action_type ON points(action_type);
CREATE INDEX idx_points_entity ON points(entity_type, entity_id);
CREATE INDEX idx_points_created_at ON points(created_at DESC);

-- ACHIEVEMENTS TABLE
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    points_required INTEGER,
    badge_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USER ACHIEVEMENTS TABLE
CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

-- Add indexes for user achievements
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- REPUTATION TABLE
CREATE TABLE reputation (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Add indexes for reputation
CREATE INDEX idx_reputation_user_id ON reputation(user_id);
CREATE INDEX idx_reputation_score ON reputation(score DESC);
CREATE INDEX idx_reputation_rank ON reputation(rank);

-- ============================================
-- SEARCH INDEX TABLE
-- ============================================
CREATE TABLE search_index (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id)
);

-- Add indexes for search index
CREATE INDEX idx_search_index_entity ON search_index(entity_type, entity_id);
CREATE INDEX idx_search_index_content ON search_index USING gin(to_tsvector('english', content));

-- ============================================
-- TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_members_updated_at BEFORE UPDATE ON group_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_media_updated_at BEFORE UPDATE ON media FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reputation_updated_at BEFORE UPDATE ON reputation FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate slug from group name
CREATE OR REPLACE FUNCTION generate_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := LOWER(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9\s]', '', 'g'));
        NEW.slug := REGEXP_REPLACE(NEW.slug, '\s+', '-', 'g');
        NEW.slug := REGEXP_REPLACE(NEW.slug, '-+', '-', 'g');
        NEW.slug := TRIM(BOTH '-' FROM NEW.slug);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add slug generation trigger for groups
CREATE TRIGGER generate_group_slug BEFORE INSERT ON groups FOR EACH ROW EXECUTE FUNCTION generate_slug();

-- Function to update post counts
CREATE OR REPLACE FUNCTION update_post_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment likes count
        UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement likes count
        UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id AND likes_count > 0;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Add trigger for likes count
CREATE TRIGGER update_likes_count AFTER INSERT OR DELETE ON likes FOR EACH ROW EXECUTE FUNCTION update_post_counts();

-- Function to update comment counts
CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment comments count
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement comments count
        UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id AND comments_count > 0;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Add trigger for comments count
CREATE TRIGGER update_comments_count AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION update_comment_counts();

-- Function to update group member count
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE groups SET member_count = member_count - 1 WHERE id = OLD.group_id AND member_count > 0;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Add trigger for group member count
CREATE TRIGGER update_group_member_count AFTER INSERT OR DELETE ON group_members FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View for user profiles with stats
CREATE VIEW user_profiles AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.display_name,
    u.bio,
    u.avatar_url,
    u.status,
    u.created_at,
    COALESCE(post_stats.post_count, 0) as post_count,
    COALESCE(friend_stats.friend_count, 0) as friend_count,
    COALESCE(rep.score, 0) as reputation_score
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as post_count
    FROM posts 
    WHERE is_active = true 
    GROUP BY user_id
) post_stats ON u.id = post_stats.user_id
LEFT JOIN (
    SELECT 
        CASE 
            WHEN requester_id < addressee_id THEN requester_id 
            ELSE addressee_id 
        END as user_id,
        COUNT(*) as friend_count
    FROM friendships 
    WHERE status = 'accepted'
    GROUP BY 
        CASE 
            WHEN requester_id < addressee_id THEN requester_id 
            ELSE addressee_id 
        END
) friend_stats ON u.id = friend_stats.user_id
LEFT JOIN reputation rep ON u.id = rep.user_id;

-- View for posts with author info
CREATE VIEW posts_with_author AS
SELECT 
    p.*,
    CASE 
        WHEN p.is_anonymous = true THEN 'Anonymous'
        ELSE u.display_name
    END as author_name,
    CASE 
        WHEN p.is_anonymous = true THEN NULL
        ELSE u.username
    END as author_username,
    u.avatar_url as author_avatar,
    g.name as group_name,
    g.privacy as group_privacy
FROM posts p
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN groups g ON p.group_id = g.id
WHERE p.is_active = true;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- You can uncomment these to add sample data for testing

-- -- Sample users
-- INSERT INTO users (username, email, password_hash, display_name, bio) VALUES
-- ('john_doe', 'john@example.com', '$2b$10$example_hash', 'John Doe', 'Software developer'),
-- ('jane_smith', 'jane@example.com', '$2b$10$example_hash', 'Jane Smith', 'Designer'),
-- ('bob_wilson', 'bob@example.com', '$2b$10$example_hash', 'Bob Wilson', 'Product manager');

-- -- Sample posts
-- INSERT INTO posts (user_id, content, visibility) VALUES
-- (1, 'Hello world! This is my first post.', 'public'),
-- (2, 'Excited to join this platform!', 'public'),
-- (3, 'Working on something amazing...', 'public');

-- ============================================
-- PERFORMANCE OPTIMIZATIONS
-- ============================================

-- Create partial indexes for better performance
CREATE INDEX idx_active_posts_public ON posts(created_at DESC) WHERE is_active = true AND visibility = 'public';
CREATE INDEX idx_active_posts_friends ON posts(created_at DESC) WHERE is_active = true AND visibility = 'friends';
CREATE INDEX idx_unread_notifications ON notifications(created_at DESC) WHERE is_read = false;
CREATE INDEX idx_active_friendships ON friendships(created_at DESC) WHERE status = 'accepted';
CREATE INDEX idx_pending_friendships ON friendships(created_at DESC) WHERE status = 'pending';

-- ============================================
-- SECURITY AND CONSTRAINTS
-- ============================================

-- Add check constraints for data integrity
ALTER TABLE posts ADD CONSTRAINT chk_content_not_empty CHECK (length(TRIM(content)) > 0);
ALTER TABLE comments ADD CONSTRAINT chk_comment_content_not_empty CHECK (length(TRIM(content)) > 0);
ALTER TABLE users ADD CONSTRAINT chk_username_length CHECK (length(username) >= 3);
ALTER TABLE users ADD CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Row Level Security (RLS) - Enable for user data protection
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic examples - customize based on your needs)
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = current_setting('app.current_user_id')::integer);

-- Posts visibility based on privacy settings
CREATE POLICY "Posts are viewable based on visibility" ON posts FOR SELECT USING (
    visibility = 'public' OR 
    user_id = current_setting('app.current_user_id')::integer
);

-- Users can only manage their own posts
CREATE POLICY "Users can manage own posts" ON posts FOR ALL USING (user_id = current_setting('app.current_user_id')::integer);

-- ============================================
-- COMPLETION
-- ============================================

-- Grant necessary permissions (adjust as needed)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_user;

-- Create a summary view for database statistics
CREATE VIEW database_stats AS
SELECT 
    'users' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
    MAX(created_at) as latest_record
FROM users
UNION ALL
SELECT 
    'posts' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
    MAX(created_at) as latest_record
FROM posts
UNION ALL
SELECT 
    'groups' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
    MAX(created_at) as latest_record
FROM groups
UNION ALL
SELECT 
    'friendships' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as active_count,
    MAX(created_at) as latest_record
FROM friendships;

COMMIT;
