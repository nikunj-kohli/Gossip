CREATE TABLE friendships (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(requester_id, addressee_id)
);

-- Indexes for faster friend lookups
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);

-- Prevent self-friendship via trigger
CREATE OR REPLACE FUNCTION prevent_self_friendship()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.requester_id = NEW.addressee_id THEN
        RAISE EXCEPTION 'Cannot create friendship with yourself';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_self_friendship
BEFORE INSERT OR UPDATE ON friendships
FOR EACH ROW EXECUTE FUNCTION prevent_self_friendship();

-- Add updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_friendships_timestamp
BEFORE UPDATE ON friendships
FOR EACH ROW EXECUTE FUNCTION update_timestamp();