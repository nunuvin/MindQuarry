SET search_path TO mqauth, public;

CREATE TABLE IF NOT EXISTS mqauth.global_admins (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    granted_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
