SET search_path TO mqauth, public;

CREATE TABLE IF NOT EXISTS mqauth.profiles (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    bio TEXT,
    reputation INTEGER DEFAULT 0,
    questions_asked INTEGER DEFAULT 0,
    replies_provided INTEGER DEFAULT 0,
    replies_accepted INTEGER DEFAULT 0,
    active_bans_count INTEGER DEFAULT 0,
    messaging_privacy VARCHAR(50) DEFAULT 'anyone',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mqauth.follows (
    follower_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    following_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    is_mutual BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS mqauth.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    type VARCHAR(50),
    source_id VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mqauth.site_settings (
    id INTEGER PRIMARY KEY,
    registration_enabled BOOLEAN DEFAULT true,
    admin_monitoring_dms BOOLEAN DEFAULT false,
    global_ban_template TEXT,
    first_admin_user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    simplified_mode_enabled BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS mqauth.quarries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE,
    description TEXT,
    min_rep_to_post INTEGER DEFAULT 0,
    min_rep_to_reply INTEGER DEFAULT 0,
    custom_ban_template TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mqauth.quarry_members (
    quarry_id UUID REFERENCES mqauth.quarries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (quarry_id, user_id)
);

CREATE TABLE IF NOT EXISTS mqauth.bans_and_timeouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    quarry_id UUID REFERENCES mqauth.quarries(id) ON DELETE CASCADE,
    issued_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    reason TEXT,
    admin_notes TEXT,
    status VARCHAR(50),
    timeout_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mqauth.queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quarry_id UUID REFERENCES mqauth.quarries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    title VARCHAR(500),
    body TEXT,
    views INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    accepted_answer_id UUID,
    is_hidden BOOLEAN DEFAULT false,
    hidden_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mqauth.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES mqauth.queries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    parent_answer_id UUID REFERENCES mqauth.answers(id) ON DELETE CASCADE,
    body TEXT,
    score INTEGER DEFAULT 0,
    is_hidden BOOLEAN DEFAULT false,
    hidden_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for accepted_answer_id on queries table (if not exists requires pg 14+ or anonymous block)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'queries_accepted_answer_id_fkey') THEN
        ALTER TABLE mqauth.queries ADD CONSTRAINT queries_accepted_answer_id_fkey FOREIGN KEY (accepted_answer_id) REFERENCES mqauth.answers(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS mqauth.query_votes (
    query_id UUID REFERENCES mqauth.queries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    value SMALLINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (query_id, user_id)
);

CREATE TABLE IF NOT EXISTS mqauth.answer_votes (
    answer_id UUID REFERENCES mqauth.answers(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    value SMALLINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (answer_id, user_id)
);

CREATE TABLE IF NOT EXISTS mqauth.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE
);

CREATE TABLE IF NOT EXISTS mqauth.query_tags (
    query_id UUID REFERENCES mqauth.queries(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES mqauth.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (query_id, tag_id)
);

CREATE TABLE IF NOT EXISTS mqauth.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group BOOLEAN DEFAULT false,
    name VARCHAR(255),
    created_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mqauth.conversation_participants (
    conversation_id UUID REFERENCES mqauth.conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS mqauth.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES mqauth.conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mqauth.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quarry_id UUID REFERENCES mqauth.quarries(id) ON DELETE CASCADE,
    target_type VARCHAR(50),
    target_id UUID,
    reporter_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    reported_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mqauth.mod_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quarry_id UUID REFERENCES mqauth.quarries(id) ON DELETE CASCADE,
    moderator_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    target_type VARCHAR(50),
    target_id UUID,
    action_type VARCHAR(50),
    admin_note TEXT,
    user_message TEXT,
    reverted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS mqauth.global_admins (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    granted_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For invite mode support
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='mqauth' AND table_name='quarries' AND column_name='is_invite_only') THEN
        ALTER TABLE mqauth.quarries ADD COLUMN is_invite_only BOOLEAN DEFAULT false;
    END IF;
END $$;
