-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT,
  category VARCHAR(50) NOT NULL,
  required_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  earned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Create user points table
CREATE TABLE IF NOT EXISTS user_points (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create point transactions table
CREATE TABLE IF NOT EXISTS point_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user reputation table
CREATE TABLE IF NOT EXISTS user_reputation (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  reputation_level INTEGER NOT NULL DEFAULT 1,
  components JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_reputation_user_id ON user_reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reputation_score ON user_reputation(reputation_score);

-- Add achievements data (example achievements)
INSERT INTO achievements (key, name, description, icon_url, category, required_points)
VALUES 
  -- Points achievements
  ('points_100', 'Beginner', 'Earn 100 points', '/icons/points_100.png', 'points', 100),
  ('points_500', 'Intermediate', 'Earn 500 points', '/icons/points_500.png', 'points', 500),
  ('points_1000', 'Advanced', 'Earn 1,000 points', '/icons/points_1000.png', 'points', 1000),
  ('points_5000', 'Expert', 'Earn 5,000 points', '/icons/points_5000.png', 'points', 5000),
  ('points_10000', 'Master', 'Earn 10,000 points', '/icons/points_10000.png', 'points', 10000),
  
  -- Posts achievements
  ('posts_1', 'First Post', 'Create your first post', '/icons/posts_1.png', 'posts', 1),
  ('posts_10', 'Regular Poster', 'Create 10 posts', '/icons/posts_10.png', 'posts', 10),
  ('posts_50', 'Frequent Poster', 'Create 50 posts', '/icons/posts_50.png', 'posts', 50),
  ('posts_100', 'Dedicated Poster', 'Create 100 posts', '/icons/posts_100.png', 'posts', 100),
  ('posts_500', 'Prolific Poster', 'Create 500 posts', '/icons/posts_500.png', 'posts', 500),
  
  -- Comments achievements
  ('comments_1', 'First Comment', 'Write your first comment', '/icons/comments_1.png', 'comments', 1),
  ('comments_10', 'Commenter', 'Write 10 comments', '/icons/comments_10.png', 'comments', 10),
  ('comments_50', 'Conversationalist', 'Write 50 comments', '/icons/comments_50.png', 'comments', 50),
  ('comments_100', 'Communicator', 'Write 100 comments', '/icons/comments_100.png', 'comments', 100),
  ('comments_500', 'Orator', 'Write 500 comments', '/icons/comments_500.png', 'comments', 500),
  
  -- Likes received achievements
  ('likes_1', 'First Like', 'Receive your first like', '/icons/likes_1.png', 'likes_received', 1),
  ('likes_10', 'Well Liked', 'Receive 10 likes', '/icons/likes_10.png', 'likes_received', 10),
  ('likes_50', 'Popular', 'Receive 50 likes', '/icons/likes_50.png', 'likes_received', 50),
  ('likes_100', 'Very Popular', 'Receive 100 likes', '/icons/likes_100.png', 'likes_received', 100),
  ('likes_500', 'Influencer', 'Receive 500 likes', '/icons/likes_500.png', 'likes_received', 500),
  
  -- Friends achievements
  ('friends_1', 'First Friend', 'Make your first friend', '/icons/friends_1.png', 'friends', 1),
  ('friends_5', 'Friendly', 'Make 5 friends', '/icons/friends_5.png', 'friends', 5),
  ('friends_10', 'Social', 'Make 10 friends', '/icons/friends_10.png', 'friends', 10),
  ('friends_25', 'Popular', 'Make 25 friends', '/icons/friends_25.png', 'friends', 25),
  ('friends_50', 'Social Butterfly', 'Make 50 friends', '/icons/friends_50.png', 'friends', 50),
  
  -- Groups achievements
  ('groups_1', 'Joiner', 'Join your first group', '/icons/groups_1.png', 'groups', 1),
  ('groups_5', 'Group Member', 'Join 5 groups', '/icons/groups_5.png', 'groups', 5),
  ('groups_10', 'Group Enthusiast', 'Join 10 groups', '/icons/groups_10.png', 'groups', 10),
  
  -- Streak achievements
  ('streak_3days', '3-Day Streak', 'Log in for 3 consecutive days', '/icons/streak_3.png', 'streak', 3),
  ('streak_7days', 'Weekly Streak', 'Log in for 7 consecutive days', '/icons/streak_7.png', 'streak', 7),
  ('streak_30days', 'Monthly Streak', 'Log in for 30 consecutive days', '/icons/streak_30.png', 'streak', 30),
  ('streak_90days', 'Quarterly Streak', 'Log in for 90 consecutive days', '/icons/streak_90.png', 'streak', 90),
  ('streak_365days', 'Yearly Streak', 'Log in for 365 consecutive days', '/icons/streak_365.png', 'streak', 365)
ON CONFLICT (key) DO NOTHING;