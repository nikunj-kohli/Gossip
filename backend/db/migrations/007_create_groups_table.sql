CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    privacy VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    avatar_url TEXT,
    cover_url TEXT,
    member_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index for faster searches
CREATE INDEX idx_groups_creator ON groups(creator_id);
CREATE INDEX idx_groups_privacy ON groups(privacy);
CREATE INDEX idx_groups_active_privacy ON groups(is_active, privacy);
CREATE INDEX idx_groups_slug ON groups(slug);

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_group_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    temp_slug TEXT;
    counter INTEGER := 1;
    slug_exists BOOLEAN;
BEGIN
    -- Convert name to lowercase and replace spaces/special chars with hyphens
    base_slug := LOWER(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9\s]', '', 'g'));
    base_slug := REGEXP_REPLACE(base_slug, '\s+', '-', 'g');
    
    -- Initial slug attempt
    temp_slug := base_slug;
    
    -- Check if slug exists
    LOOP
        SELECT EXISTS(SELECT 1 FROM groups WHERE slug = temp_slug) INTO slug_exists;
        EXIT WHEN NOT slug_exists;
        
        -- If exists, append counter and increment
        temp_slug := base_slug || '-' || counter;
        counter := counter + 1;
    END LOOP;
    
    -- Set the unique slug
    NEW.slug := temp_slug;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate slug before insert
CREATE TRIGGER before_insert_generate_slug
BEFORE INSERT ON groups
FOR EACH ROW
EXECUTE FUNCTION generate_group_slug();

-- Add updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_groups_timestamp
BEFORE UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION update_group_timestamp();