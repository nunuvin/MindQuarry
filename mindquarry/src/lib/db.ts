import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

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
    messaging_privacy: string | null;
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
}

interface QuarriesTable {
    id: string;
    name: string | null;
    description: string | null;
    min_rep_to_post: number | null;
    min_rep_to_reply: number | null;
    custom_ban_template: string | null;
    is_invite_only: boolean | null;
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
    views: number | null;
    score: number | null;
    accepted_answer_id: string | null;
    is_hidden: boolean | null;
    hidden_at: Date | null;
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
    created_at: Date | null;
}

interface UserReportsTable {
    id: string;
    quarry_id: string | null;
    target_type: string | null;
    target_id: string | null;
    reporter_id: string | null;
    reported_id: string | null;
    reason: string | null;
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
    query_tags: QueryTagsTable;
    conversations: ConversationsTable;
    conversation_participants: ConversationParticipantsTable;
    messages: MessagesTable;
    user_reports: UserReportsTable;
    mod_actions: ModActionsTable;
    global_admins: {
        user_id: string;
        granted_by_id: string | null;
        created_at: Date | null;
    };
}

const dialect = new PostgresDialect({
    pool: new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: false,
    }),
});

export const db = new Kysely<Database>({
    dialect,
}).withSchema("mqauth");
