import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    options: "-c search_path=mq_public,mqauth",
});

// Better Auth tables

interface UserTable {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean | null;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    username: string | null;
    displayUsername: string | null;
    role: string | null;
    banned: boolean | null;
    banReason: string | null;
    banExpires: Date | null;
}

interface SessionTable {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
    impersonatedBy: string | null;
}

interface AccountTable {
    id: string;
    userId: string;
    accountId: string;
    providerId: string;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    scope: string | null;
    idToken: string | null;
    password: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface VerificationTable {
    id: string;
    identifier: string;
    value: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

// MindQuarry Core Tables

interface ProfilesTable {
    user_id: string;
    bio: string | null;
    reputation: number | null;
    questions_asked: number | null;
    replies_provided: number | null;
    replies_accepted: number | null;
    active_bans_count: number | null;
    profile_visibility: string | null;
    messaging_privacy: string | null;
    mention_notifications: string | null;
    force_password_reset: boolean | null;
    created_at: Date | null;
    updated_at: Date | null;
}

interface FollowsTable {
    follower_id: string;
    following_id: string;
    is_mutual: boolean | null;
    created_at: Date | null;
}

interface NotificationsTable {
    id: string;
    user_id: string | null;
    type: string | null;
    source_id: string | null;
    actor_user_id: string | null;
    title: string | null;
    body: string | null;
    href: string | null;
    query_id: string | null;
    answer_id: string | null;
    is_read: boolean | null;
    created_at: Date | null;
}

interface SiteSettingsTable {
    id: number;
    registration_enabled: boolean | null;
    admin_monitoring_dms: boolean | null;
    global_ban_template: string | null;
    first_admin_user_id: string | null;
    simplified_mode_enabled: boolean | null;
    chat_report_context_size: number | null;
}

interface QuarriesTable {
    id: string;
    name: string | null;
    description: string | null;
    min_rep_to_post: number | null;
    min_rep_to_reply: number | null;
    custom_ban_template: string | null;
    is_invite_only: boolean | null;
    visibility: string | null;
    allow_user_tags: boolean | null;
    content_review_mode: string | null;
    created_at: Date | null;
}

interface QuerySubscriptionsTable {
    query_id: string;
    user_id: string;
    reason: string | null;
    created_at: Date | null;
}

interface QuarryMembersTable {
    quarry_id: string;
    user_id: string;
    role: string | null;
    created_at: Date | null;
}

interface BansAndTimeoutsTable {
    id: string;
    user_id: string | null;
    quarry_id: string | null;
    issued_by_id: string | null;
    reason: string | null;
    admin_notes: string | null;
    status: string | null;
    timeout_until: Date | null;
    created_at: Date | null;
}

interface QueriesTable {
    id: string;
    quarry_id: string | null;
    user_id: string | null;
    title: string | null;
    body: string | null;
    score: number | null;
    accepted_answer_id: string | null;
    is_hidden: boolean | null;
    hidden_at: Date | null;
    hidden_by_id: string | null;
    validation_status: string | null;
    validation_note: string | null;
    validated_at: Date | null;
    validated_by_id: string | null;
    is_archived: boolean | null;
    archived_at: Date | null;
    archived_by_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
}

interface AnswersTable {
    id: string;
    query_id: string | null;
    user_id: string | null;
    parent_answer_id: string | null;
    body: string | null;
    score: number | null;
    is_hidden: boolean | null;
    hidden_at: Date | null;
    hidden_by_id: string | null;
    validation_status: string | null;
    validation_note: string | null;
    validated_at: Date | null;
    validated_by_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
}

interface QueryVotesTable {
    query_id: string;
    user_id: string;
    value: number | null;
    created_at: Date | null;
}

interface AnswerVotesTable {
    answer_id: string;
    user_id: string;
    value: number | null;
    created_at: Date | null;
}

interface TagsTable {
    id: string;
    name: string | null;
    description: string | null;
    quarry_id: string | null;
    created_by_user_id: string | null;
    is_default: boolean | null;
    created_at: Date | null;
}

interface QueryViewsTable {
    query_id: string;
    views: number | null;
}

interface QueryViewSessionsTable {
    query_id: string;
    viewer_key: string;
    last_viewed_at: Date | null;
}

interface QueryTagsTable {
    query_id: string;
    tag_id: string;
}

interface ConversationsTable {
    id: string;
    is_group: boolean | null;
    name: string | null;
    created_by_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
}

interface ConversationParticipantsTable {
    conversation_id: string;
    user_id: string;
    role: string | null;
    last_read_at: Date | null;
}

interface MessagesTable {
    id: string;
    conversation_id: string | null;
    sender_id: string | null;
    body: string | null;
    is_hidden: boolean | null;
    hidden_at: Date | null;
    hidden_by_id: string | null;
    created_at: Date | null;
}

interface PostingPoliciesTable {
    id: string;
    quarry_id: string | null;
    user_id: string | null;
    review_mode: string | null;
    can_post_queries: boolean | null;
    can_post_answers: boolean | null;
    created_by_id: string | null;
    updated_by_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
}

interface UserReportsTable {
    id: string;
    quarry_id: string | null;
    target_type: string | null;
    target_id: string | null;
    conversation_id: string | null;
    reporter_id: string | null;
    reported_id: string | null;
    reason: string | null;
    target_preview: string | null;
    context_snapshot: string | null;
    context_size: number | null;
    escalated_by_id: string | null;
    escalated_from_quarry_id: string | null;
    status: string | null;
    created_at: Date | null;
}

interface ModActionsTable {
    id: string;
    quarry_id: string | null;
    moderator_id: string | null;
    target_type: string | null;
    target_id: string | null;
    action_type: string | null;
    admin_note: string | null;
    user_message: string | null;
    reverted_at: Date | null;
    created_at: Date | null;
}

export interface Database {
    user: UserTable;
    session: SessionTable;
    account: AccountTable;
    verification: VerificationTable;
    profiles: ProfilesTable;
    follows: FollowsTable;
    notifications: NotificationsTable;
    site_settings: SiteSettingsTable;
    quarries: QuarriesTable;
    quarry_members: QuarryMembersTable;
    bans_and_timeouts: BansAndTimeoutsTable;
    queries: QueriesTable;
    answers: AnswersTable;
    query_votes: QueryVotesTable;
    answer_votes: AnswerVotesTable;
    tags: TagsTable;
    query_views: QueryViewsTable;
    query_view_sessions: QueryViewSessionsTable;
    query_tags: QueryTagsTable;
    query_subscriptions: QuerySubscriptionsTable;
    conversations: ConversationsTable;
    conversation_participants: ConversationParticipantsTable;
    messages: MessagesTable;
    user_reports: UserReportsTable;
    mod_actions: ModActionsTable;
    posting_policies: PostingPoliciesTable;
    global_admins: {
        user_id: string;
        granted_by_id: string | null;
        created_at: Date | null;
    };
    background_jobs: {
        id: string;
        job_type: string;
        payload: unknown;
        status: string | null;
        created_at: Date | null;
        locked_at: Date | null;
        locked_by: string | null;
    };
}

const dialect = new PostgresDialect({
    pool,
});

/**
 * Global Kysely database client.
 * Note: Since we use cross-schema setups (mqauth & mq_public),
 * we avoid using .withSchema() which would strictly prefix ALL queries.
 * Instead, schema resolution relies on the pool's PostgreSQL search_path or explicit SQL joins.
 */
export const db = new Kysely<Database>({
    dialect,
});
