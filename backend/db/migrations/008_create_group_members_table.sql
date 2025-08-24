CREATE TABLE group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    is_banned BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- Indexes for faster lookups
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_role ON group_members(group_id, role);
CREATE INDEX idx_group_members_banned ON group_members(group_id, is_banned);

-- Add updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_group_member_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_group_members_timestamp
BEFORE UPDATE ON group_members
FOR EACH ROW EXECUTE FUNCTION update_group_member_timestamp();

-- Trigger to increment/decrement group member_count
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
    -- When a member is added and not banned
    IF TG_OP = 'INSERT' AND NEW.is_banned = FALSE THEN
        UPDATE groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    
    -- When a member is removed (and was not banned)
    ELSIF TG_OP = 'DELETE' AND OLD.is_banned = FALSE THEN
        UPDATE groups SET member_count = member_count - 1 WHERE id = OLD.group_id AND member_count > 0;
    
    -- When a member is banned (was not previously banned)
    ELSIF TG_OP = 'UPDATE' AND OLD.is_banned = FALSE AND NEW.is_banned = TRUE THEN
        UPDATE groups SET member_count = member_count - 1 WHERE id = NEW.group_id AND member_count > 0;
    
    -- When a member is unbanned (was previously banned)
    ELSIF TG_OP = 'UPDATE' AND OLD.is_banned = TRUE AND NEW.is_banned = FALSE THEN
        UPDATE groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_member_count_insert
AFTER INSERT ON group_members
FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

CREATE TRIGGER update_member_count_delete
AFTER DELETE ON group_members
FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

CREATE TRIGGER update_member_count_update
AFTER UPDATE OF is_banned ON group_members
FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

-- Ensure creator is automatically an admin when creating a group
CREATE OR REPLACE FUNCTION add_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.creator_id, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER group_creator_as_admin
AFTER INSERT ON groups
FOR EACH ROW EXECUTE FUNCTION add_creator_as_admin();