-- Add group_id to posts table to allow posts in groups
ALTER TABLE posts
ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE;

-- Create index for faster group post lookups
CREATE INDEX idx_posts_group_id ON posts(group_id);

-- Trigger to increment/decrement group post_count
CREATE OR REPLACE FUNCTION update_group_post_count()
RETURNS TRIGGER AS $$
BEGIN
    -- When a post is added to a group
    IF TG_OP = 'INSERT' AND NEW.group_id IS NOT NULL THEN
        UPDATE groups SET post_count = post_count + 1 WHERE id = NEW.group_id;
    
    -- When a post is removed from a group (hard delete scenario)
    ELSIF TG_OP = 'DELETE' AND OLD.group_id IS NOT NULL THEN
        UPDATE groups SET post_count = post_count - 1 WHERE id = OLD.group_id AND post_count > 0;
    
    -- When a post is moved between groups or from/to a group
    ELSIF TG_OP = 'UPDATE' THEN
        -- If group_id changed from NULL to a value (added to a group)
        IF OLD.group_id IS NULL AND NEW.group_id IS NOT NULL THEN
            UPDATE groups SET post_count = post_count + 1 WHERE id = NEW.group_id;
        
        -- If group_id changed from a value to NULL (removed from a group)
        ELSIF OLD.group_id IS NOT NULL AND NEW.group_id IS NULL THEN
            UPDATE groups SET post_count = post_count - 1 WHERE id = OLD.group_id AND post_count > 0;
        
        -- If group_id changed from one group to another
        ELSIF OLD.group_id IS NOT NULL AND NEW.group_id IS NOT NULL AND OLD.group_id != NEW.group_id THEN
            UPDATE groups SET post_count = post_count - 1 WHERE id = OLD.group_id AND post_count > 0;
            UPDATE groups SET post_count = post_count + 1 WHERE id = NEW.group_id;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Soft delete handling - when a post is soft-deleted (is_active changed to false)
CREATE OR REPLACE FUNCTION handle_post_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- If post is deactivated and belongs to a group
    IF NEW.is_active = FALSE AND OLD.is_active = TRUE AND NEW.group_id IS NOT NULL THEN
        UPDATE groups SET post_count = post_count - 1 WHERE id = NEW.group_id AND post_count > 0;
    
    -- If post is reactivated and belongs to a group
    ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE AND NEW.group_id IS NOT NULL THEN
        UPDATE groups SET post_count = post_count + 1 WHERE id = NEW.group_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_group_post_count_insert_delete
AFTER INSERT OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION update_group_post_count();

CREATE TRIGGER update_group_post_count_update
AFTER UPDATE OF group_id ON posts
FOR EACH ROW EXECUTE FUNCTION update_group_post_count();

CREATE TRIGGER handle_post_soft_delete_trigger
AFTER UPDATE OF is_active ON posts
FOR EACH ROW EXECUTE FUNCTION handle_post_soft_delete();