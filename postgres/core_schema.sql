CREATE SCHEMA IF NOT EXISTS mq_public AUTHORIZATION mqauth_user;

SET search_path TO mq_public, mqauth;

CREATE TABLE IF NOT EXISTS mq_public.profiles (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    bio TEXT,
    reputation INTEGER DEFAULT 0,
    questions_asked INTEGER DEFAULT 0,
    replies_provided INTEGER DEFAULT 0,
    replies_accepted INTEGER DEFAULT 0,
    active_bans_count INTEGER DEFAULT 0,
    profile_visibility VARCHAR(50) DEFAULT 'public',
    messaging_privacy VARCHAR(50) DEFAULT 'anyone',
    mention_notifications VARCHAR(50) DEFAULT 'all',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.follows (
    follower_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    following_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    is_mutual BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS mq_public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    type VARCHAR(50),
    source_id VARCHAR(255),
    actor_user_id VARCHAR(255),
    title TEXT,
    body TEXT,
    href TEXT,
    query_id UUID,
    answer_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.site_settings (
    id INTEGER PRIMARY KEY,
    registration_enabled BOOLEAN DEFAULT true,
    admin_monitoring_dms BOOLEAN DEFAULT false,
    global_ban_template TEXT,
    first_admin_user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    simplified_mode_enabled BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS mq_public.quarries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE,
    description TEXT,
    min_rep_to_post INTEGER DEFAULT 0,
    min_rep_to_reply INTEGER DEFAULT 0,
    custom_ban_template TEXT,
    is_invite_only BOOLEAN DEFAULT false,
    visibility VARCHAR(50) DEFAULT 'public',
    allow_user_tags BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.quarry_members (
    quarry_id UUID REFERENCES mq_public.quarries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (quarry_id, user_id)
);

CREATE TABLE IF NOT EXISTS mq_public.bans_and_timeouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    quarry_id UUID REFERENCES mq_public.quarries(id) ON DELETE CASCADE,
    issued_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    reason TEXT,
    admin_notes TEXT,
    status VARCHAR(50),
    timeout_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quarry_id UUID REFERENCES mq_public.quarries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    title VARCHAR(500),
    body TEXT,
    score INTEGER DEFAULT 0,
    accepted_answer_id UUID,
    is_hidden BOOLEAN DEFAULT false,
    hidden_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.query_subscriptions (
    query_id UUID REFERENCES mq_public.queries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    reason VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (query_id, user_id)
);

CREATE TABLE IF NOT EXISTS mq_public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES mq_public.queries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    parent_answer_id UUID REFERENCES mq_public.answers(id) ON DELETE CASCADE,
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
        ALTER TABLE mq_public.queries ADD CONSTRAINT queries_accepted_answer_id_fkey FOREIGN KEY (accepted_answer_id) REFERENCES mq_public.answers(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS mq_public.query_votes (
    query_id UUID REFERENCES mq_public.queries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    value SMALLINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (query_id, user_id)
);

CREATE TABLE IF NOT EXISTS mq_public.answer_votes (
    answer_id UUID REFERENCES mq_public.answers(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    value SMALLINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (answer_id, user_id)
);

CREATE TABLE IF NOT EXISTS mq_public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    description TEXT,
    quarry_id UUID REFERENCES mq_public.quarries(id) ON DELETE CASCADE,
    created_by_user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNLOGGED TABLE IF NOT EXISTS mq_public.query_views (
    query_id UUID PRIMARY KEY REFERENCES mq_public.queries(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mq_public.query_view_sessions (
    query_id UUID REFERENCES mq_public.queries(id) ON DELETE CASCADE,
    viewer_key VARCHAR(128) NOT NULL,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (query_id, viewer_key)
);

CREATE TABLE IF NOT EXISTS mq_public.query_tags (
    query_id UUID REFERENCES mq_public.queries(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES mq_public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (query_id, tag_id)
);

CREATE TABLE IF NOT EXISTS mq_public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group BOOLEAN DEFAULT false,
    name VARCHAR(255),
    created_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.conversation_participants (
    conversation_id UUID REFERENCES mq_public.conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS mq_public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES mq_public.conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notify trigger for new messages
CREATE OR REPLACE FUNCTION mq_public.notify_new_message() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_message_event', NEW.conversation_id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_message ON mq_public.messages;
CREATE TRIGGER trigger_notify_new_message
AFTER INSERT ON mq_public.messages
FOR EACH ROW EXECUTE FUNCTION mq_public.notify_new_message();

-- Notify trigger for read receipts
CREATE OR REPLACE FUNCTION mq_public.notify_read_receipt() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('read_receipt_event', NEW.conversation_id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_read_receipt ON mq_public.conversation_participants;
CREATE TRIGGER trigger_notify_read_receipt
AFTER UPDATE OF last_read_at ON mq_public.conversation_participants
FOR EACH ROW EXECUTE FUNCTION mq_public.notify_read_receipt();

CREATE TABLE IF NOT EXISTS mq_public.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quarry_id UUID REFERENCES mq_public.quarries(id) ON DELETE CASCADE,
    target_type VARCHAR(50),
    target_id UUID,
    reporter_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    reported_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.mod_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quarry_id UUID REFERENCES mq_public.quarries(id) ON DELETE CASCADE,
    moderator_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    target_type VARCHAR(50),
    target_id UUID,
    action_type VARCHAR(50),
    admin_note TEXT,
    user_message TEXT,
    reverted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.global_admins (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    granted_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mq_public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(255)
);

GRANT USAGE ON SCHEMA mq_public TO mqauth_user;
GRANT CREATE ON SCHEMA mq_public TO mqauth_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mq_public TO mqauth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA mq_public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mqauth_user;

WITH default_instance_tags(name, description) AS (
    VALUES
        ('discussion', 'Open-ended product or community discussion.'),
        ('help-wanted', 'The author is looking for direct implementation help.'),
        ('bug', 'Unexpected behavior or a defect report.'),
        ('performance', 'Performance, scaling, or latency concerns.'),
        ('database', 'Database modeling, queries, or migrations.'),
        ('search', 'Search relevance, indexing, or retrieval topics.'),
        ('testing', 'Unit, integration, or end-to-end testing questions.'),
        ('authentication', 'Auth, sessions, identity, and permissions.')
)
INSERT INTO mq_public.tags (id, name, description, quarry_id, created_by_user_id, is_default)
SELECT gen_random_uuid(), source.name, source.description, NULL, NULL, true
FROM default_instance_tags AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM mq_public.tags existing
    WHERE existing.quarry_id IS NULL
      AND lower(existing.name) = lower(source.name)
);

WITH default_quarry_tags(name, description) AS (
    VALUES
        ('getting-started', 'Entry-level questions and onboarding topics.'),
        ('troubleshooting', 'Debugging and problem diagnosis.'),
        ('best-practices', 'Recommended approaches and architecture guidance.')
)
INSERT INTO mq_public.tags (id, name, description, quarry_id, created_by_user_id, is_default)
SELECT gen_random_uuid(), defaults.name, defaults.description, quarries.id, NULL, true
FROM mq_public.quarries quarries
CROSS JOIN default_quarry_tags defaults
WHERE NOT EXISTS (
    SELECT 1
    FROM mq_public.tags existing
    WHERE existing.quarry_id = quarries.id
      AND lower(existing.name) = lower(defaults.name)
);

COMMENT ON TABLE mq_public.profiles IS 'Extended user profiles bridging to Better Auth identities';
COMMENT ON TABLE mq_public.queries IS 'Top-level questions/posts submitted by users to Quarries';
COMMENT ON TABLE mq_public.answers IS 'Replies to queries or nested answers (Reddit-style)';
