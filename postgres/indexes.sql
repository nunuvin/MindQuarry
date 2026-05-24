SET search_path TO mq_public, mqauth;

-- Performance optimization indexes for MindQuarry Core
CREATE INDEX IF NOT EXISTS idx_queries_quarry_id ON mq_public.queries(quarry_id);
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON mq_public.queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON mq_public.queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_query_id ON mq_public.answers(query_id);
CREATE INDEX IF NOT EXISTS idx_answers_parent_id ON mq_public.answers(parent_answer_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_quarry_id ON mq_public.user_reports(quarry_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON mq_public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_subscriptions_user_id ON mq_public.query_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_view_sessions_last_viewed_at ON mq_public.query_view_sessions(last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_tags_tag_id ON mq_public.query_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_quarry_id ON mq_public.tags(quarry_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_global_name_unique ON mq_public.tags (lower(name)) WHERE quarry_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_quarry_name_unique ON mq_public.tags (quarry_id, lower(name)) WHERE quarry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quarries_name_trgm ON mq_public.quarries USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm ON mq_public.tags USING GIN (lower(name) gin_trgm_ops);

COMMENT ON TABLE mq_public.profiles IS 'Extended user profiles bridging to Better Auth identities';
COMMENT ON TABLE mq_public.queries IS 'Top-level questions/posts submitted by users to Quarries';
COMMENT ON TABLE mq_public.answers IS 'Replies to queries or nested answers (Reddit-style)';
