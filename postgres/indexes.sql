SET search_path TO mq_public, mq_auth;

-- Performance optimization indexes for MindQuarry Core
CREATE INDEX IF NOT EXISTS idx_queries_quarry_id ON mq_public.queries(quarry_id);
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON mq_public.queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON mq_public.queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_query_id ON mq_public.answers(query_id);
CREATE INDEX IF NOT EXISTS idx_answers_parent_id ON mq_public.answers(parent_answer_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_quarry_id ON mq_public.user_reports(quarry_id, status);

COMMENT ON TABLE mq_public.profiles IS 'Extended user profiles bridging to Better Auth identities';
COMMENT ON TABLE mq_public.queries IS 'Top-level questions/posts submitted by users to Quarries';
COMMENT ON TABLE mq_public.answers IS 'Replies to queries or nested answers (Reddit-style)';
