SET search_path TO mq_public, mqauth;

-- Performance optimization indexes for MindQuarry Core
CREATE INDEX IF NOT EXISTS idx_queries_quarry_id ON mq_public.queries(quarry_id);
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON mq_public.queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON mq_public.queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_query_id ON mq_public.answers(query_id);
CREATE INDEX IF NOT EXISTS idx_answers_parent_id ON mq_public.answers(parent_answer_id);
CREATE INDEX IF NOT EXISTS idx_answers_validation_status ON mq_public.answers(validation_status, query_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_quarry_id ON mq_public.user_reports(quarry_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON mq_public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON mq_public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_hidden_status ON mq_public.messages(is_hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posting_policies_lookup ON mq_public.posting_policies(quarry_id, user_id);
CREATE INDEX IF NOT EXISTS idx_query_subscriptions_user_id ON mq_public.query_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_view_sessions_last_viewed_at ON mq_public.query_view_sessions(last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_tags_tag_id ON mq_public.query_tags(tag_id);
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

CREATE INDEX IF NOT EXISTS idx_queries_validation_status ON mq_public.queries(validation_status, quarry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_archived_status ON mq_public.queries(is_archived, quarry_id, created_at DESC);

COMMENT ON TABLE mq_public.profiles IS 'Extended user profiles bridging to Better Auth identities';
COMMENT ON TABLE mq_public.queries IS 'Top-level questions/posts submitted by users to Quarries';
COMMENT ON TABLE mq_public.answers IS 'Replies to queries or nested answers (Reddit-style)';
COMMENT ON TABLE mq_public.posting_policies IS 'Instance-wide or quarry-scoped review and posting overrides, optionally targeting a specific user.';
