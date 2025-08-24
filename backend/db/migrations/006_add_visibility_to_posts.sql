ALTER TABLE posts
ADD COLUMN visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private'));