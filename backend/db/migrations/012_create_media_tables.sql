-- Create media table
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  public_id TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'image',
  width INTEGER,
  height INTEGER,
  size INTEGER,
  variants JSONB,
  alt TEXT,
  metadata JSONB DEFAULT '{}',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_media junction table
CREATE TABLE IF NOT EXISTS post_media (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, media_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
CREATE INDEX IF NOT EXISTS idx_media_is_deleted ON media(is_deleted);
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_media_id ON post_media(media_id);