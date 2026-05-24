CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SET search_path TO mq_public, mqauth;

INSERT INTO mqauth."user" (
    "id",
    "name",
    "email",
    "emailVerified",
    "image",
    "username",
    "displayUsername",
    "role",
    "banned"
)
SELECT
    '-1',
    'Deleted User',
    'deleted-user@mindquarry.local',
    true,
    NULL,
    'deleted-user',
    'Deleted User',
    'system',
    true
WHERE NOT EXISTS (
    SELECT 1
    FROM mqauth."user"
    WHERE "id" = '-1'
);

CREATE TABLE IF NOT EXISTS mq_public.query_subscriptions (
    query_id UUID REFERENCES mq_public.queries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    reason VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (query_id, user_id)
);

CREATE TABLE IF NOT EXISTS mq_public.query_view_sessions (
    query_id UUID REFERENCES mq_public.queries(id) ON DELETE CASCADE,
    viewer_key VARCHAR(128) NOT NULL,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (query_id, viewer_key)
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

ALTER TABLE mq_public.site_settings
    ADD COLUMN IF NOT EXISTS global_ban_template TEXT DEFAULT 'Your account has been suspended for violating platform rules.';

ALTER TABLE mq_public.profiles
    ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(50) DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS mention_notifications VARCHAR(50) DEFAULT 'all';

ALTER TABLE mq_public.quarries
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS allow_user_tags BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS content_review_mode VARCHAR(50) DEFAULT 'none';

ALTER TABLE mq_public.queries
    ADD COLUMN IF NOT EXISTS hidden_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS validation_note TEXT,
    ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS validated_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL;

ALTER TABLE mq_public.answers
    ADD COLUMN IF NOT EXISTS hidden_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS validation_note TEXT,
    ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS validated_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL;

ALTER TABLE mq_public.messages
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hidden_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL;

ALTER TABLE mq_public.notifications
    ADD COLUMN IF NOT EXISTS actor_user_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS body TEXT,
    ADD COLUMN IF NOT EXISTS href TEXT,
    ADD COLUMN IF NOT EXISTS query_id UUID,
    ADD COLUMN IF NOT EXISTS answer_id UUID;

ALTER TABLE mq_public.tags
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS quarry_id UUID REFERENCES mq_public.quarries(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE mq_public.tags DROP CONSTRAINT IF EXISTS tags_name_key;

CREATE TABLE IF NOT EXISTS mq_public.posting_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quarry_id UUID REFERENCES mq_public.quarries(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE CASCADE,
    review_mode VARCHAR(50) DEFAULT 'none',
    can_post_queries BOOLEAN DEFAULT true,
    can_post_answers BOOLEAN DEFAULT true,
    created_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    updated_by_id VARCHAR(255) REFERENCES mqauth."user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

UPDATE mq_public.queries
SET validation_status = 'approved'
WHERE validation_status IS NULL OR validation_status = '';

UPDATE mq_public.answers
SET validation_status = 'approved'
WHERE validation_status IS NULL OR validation_status = '';

UPDATE mq_public.queries
SET is_archived = false
WHERE is_archived IS NULL;

UPDATE mq_public.quarries
SET visibility = CASE
    WHEN coalesce(is_invite_only, false) THEN 'members'
    ELSE 'public'
END
WHERE visibility IS NULL OR visibility = '';

CREATE INDEX IF NOT EXISTS idx_queries_quarry_id ON mq_public.queries(quarry_id);
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON mq_public.queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON mq_public.queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_validation_status ON mq_public.queries(validation_status, quarry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_archived_status ON mq_public.queries(is_archived, quarry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_query_id ON mq_public.answers(query_id);
CREATE INDEX IF NOT EXISTS idx_answers_parent_id ON mq_public.answers(parent_answer_id);
CREATE INDEX IF NOT EXISTS idx_answers_validation_status ON mq_public.answers(validation_status, query_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_quarry_id ON mq_public.user_reports(quarry_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON mq_public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_hidden_status ON mq_public.messages(is_hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON mq_public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_subscriptions_user_id ON mq_public.query_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_view_sessions_last_viewed_at ON mq_public.query_view_sessions(last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_tags_tag_id ON mq_public.query_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_posting_policies_lookup ON mq_public.posting_policies(quarry_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posting_policies_instance_default_unique ON mq_public.posting_policies((1)) WHERE quarry_id IS NULL AND user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_posting_policies_quarry_default_unique ON mq_public.posting_policies(quarry_id) WHERE quarry_id IS NOT NULL AND user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_posting_policies_instance_user_unique ON mq_public.posting_policies(user_id) WHERE quarry_id IS NULL AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_posting_policies_quarry_user_unique ON mq_public.posting_policies(quarry_id, user_id) WHERE quarry_id IS NOT NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tags_quarry_id ON mq_public.tags(quarry_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_global_name_unique ON mq_public.tags (lower(name)) WHERE quarry_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_quarry_name_unique ON mq_public.tags (quarry_id, lower(name)) WHERE quarry_id IS NOT NULL;

DO $$
DECLARE
    pg_trgm_schema TEXT;
BEGIN
    SELECT namespace.nspname
    INTO pg_trgm_schema
    FROM pg_extension extension
    JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
    WHERE extension.extname = 'pg_trgm';

    IF pg_trgm_schema IS NULL THEN
        RAISE EXCEPTION 'pg_trgm extension must be installed before creating trigram indexes';
    END IF;

    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_quarries_name_trgm ON mq_public.quarries USING GIN (lower(name) %I.gin_trgm_ops)',
        pg_trgm_schema
    );

    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_tags_name_trgm ON mq_public.tags USING GIN (lower(name) %I.gin_trgm_ops)',
        pg_trgm_schema
    );
END $$;

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