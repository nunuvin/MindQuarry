import { db } from "./db";
import { generateUUID } from "./utils";

export const REVIEW_MODE_NONE = "none";
export const REVIEW_MODE_QUERY = "query";
export const REVIEW_MODE_QUERY_AND_ANSWER = "query_and_answer";

export const REVIEW_MODE_OPTIONS = [
    REVIEW_MODE_NONE,
    REVIEW_MODE_QUERY,
    REVIEW_MODE_QUERY_AND_ANSWER,
] as const;

export type ReviewMode = typeof REVIEW_MODE_OPTIONS[number];

export type ResolvedPostingPolicy = {
    reviewMode: ReviewMode;
    canPostQueries: boolean;
    canPostAnswers: boolean;
};

type PostingPolicyRow = {
    id: string;
    quarry_id: string | null;
    user_id: string | null;
    review_mode: string | null;
    can_post_queries: boolean | null;
    can_post_answers: boolean | null;
};

const DEFAULT_POSTING_POLICY: ResolvedPostingPolicy = {
    reviewMode: REVIEW_MODE_NONE,
    canPostQueries: true,
    canPostAnswers: true,
};

function normalizeReviewMode(value: string | null | undefined): ReviewMode {
    if (value === REVIEW_MODE_QUERY || value === REVIEW_MODE_QUERY_AND_ANSWER) {
        return value;
    }

    return REVIEW_MODE_NONE;
}

function applyPostingPolicy(base: ResolvedPostingPolicy, row: PostingPolicyRow | null | undefined): ResolvedPostingPolicy {
    if (!row) {
        return base;
    }

    return {
        reviewMode: normalizeReviewMode(row.review_mode) || base.reviewMode,
        canPostQueries: typeof row.can_post_queries === "boolean" ? row.can_post_queries : base.canPostQueries,
        canPostAnswers: typeof row.can_post_answers === "boolean" ? row.can_post_answers : base.canPostAnswers,
    };
}

export function resolvePostingPolicyRows(rows: {
    instanceDefault?: PostingPolicyRow | null;
    quarryDefault?: PostingPolicyRow | null;
    instanceUser?: PostingPolicyRow | null;
    quarryUser?: PostingPolicyRow | null;
}) {
    return [rows.instanceDefault, rows.quarryDefault, rows.instanceUser, rows.quarryUser]
        .reduce((current, row) => applyPostingPolicy(current, row), DEFAULT_POSTING_POLICY);
}

export async function getQuarryMembershipRole(quarryId: string, userId: string) {
    const membership = await db.selectFrom("quarry_members")
        .select("role")
        .where("quarry_id", "=", quarryId)
        .where("user_id", "=", userId)
        .executeTakeFirst();

    return membership?.role || null;
}

export function canAdministerQuarry(role: string | null | undefined) {
    return role === "admin";
}

export function canModerateQuarry(role: string | null | undefined) {
    return role === "admin" || role === "moderator";
}

export function shouldReviewQuery(policy: ResolvedPostingPolicy) {
    return policy.reviewMode === REVIEW_MODE_QUERY || policy.reviewMode === REVIEW_MODE_QUERY_AND_ANSWER;
}

export function shouldReviewAnswer(policy: ResolvedPostingPolicy) {
    return policy.reviewMode === REVIEW_MODE_QUERY_AND_ANSWER;
}

export async function getEffectivePostingPolicy(options: {
    quarryId: string;
    userId: string;
}) {
    const [instanceDefault, quarryDefault, instanceUser, quarryUser, quarry] = await Promise.all([
        db.selectFrom("posting_policies")
            .select(["id", "quarry_id", "user_id", "review_mode", "can_post_queries", "can_post_answers"])
            .where("quarry_id", "is", null)
            .where("user_id", "is", null)
            .executeTakeFirst(),
        db.selectFrom("posting_policies")
            .select(["id", "quarry_id", "user_id", "review_mode", "can_post_queries", "can_post_answers"])
            .where("quarry_id", "=", options.quarryId)
            .where("user_id", "is", null)
            .executeTakeFirst(),
        db.selectFrom("posting_policies")
            .select(["id", "quarry_id", "user_id", "review_mode", "can_post_queries", "can_post_answers"])
            .where("quarry_id", "is", null)
            .where("user_id", "=", options.userId)
            .executeTakeFirst(),
        db.selectFrom("posting_policies")
            .select(["id", "quarry_id", "user_id", "review_mode", "can_post_queries", "can_post_answers"])
            .where("quarry_id", "=", options.quarryId)
            .where("user_id", "=", options.userId)
            .executeTakeFirst(),
        db.selectFrom("quarries")
            .select(["id", "content_review_mode"])
            .where("id", "=", options.quarryId)
            .executeTakeFirst(),
    ]);

    return resolvePostingPolicyRows({
        instanceDefault,
        quarryDefault: quarryDefault || (quarry ? {
            id: `quarry-default:${quarry.id}`,
            quarry_id: quarry.id,
            user_id: null,
            review_mode: quarry.content_review_mode || REVIEW_MODE_NONE,
            can_post_queries: true,
            can_post_answers: true,
        } : null),
        instanceUser,
        quarryUser,
    });
}

export async function upsertPostingPolicy(options: {
    actorUserId: string;
    quarryId?: string | null;
    userId?: string | null;
    reviewMode: string;
    canPostQueries: boolean;
    canPostAnswers: boolean;
}) {
    const quarryId = options.quarryId || null;
    const userId = options.userId || null;
    const reviewMode = normalizeReviewMode(options.reviewMode);

    const existing = await db.selectFrom("posting_policies")
        .select("id")
        .where((eb) => userId
            ? eb.and([
                quarryId ? eb("quarry_id", "=", quarryId) : eb("quarry_id", "is", null),
                eb("user_id", "=", userId),
            ])
            : eb.and([
                quarryId ? eb("quarry_id", "=", quarryId) : eb("quarry_id", "is", null),
                eb("user_id", "is", null),
            ]))
        .executeTakeFirst();

    if (existing?.id) {
        await db.updateTable("posting_policies")
            .set({
                review_mode: reviewMode,
                can_post_queries: options.canPostQueries,
                can_post_answers: options.canPostAnswers,
                updated_by_id: options.actorUserId,
                updated_at: new Date(),
            })
            .where("id", "=", existing.id)
            .execute();

        return existing.id;
    }

    const inserted = await db.insertInto("posting_policies")
        .values({
            id: generateUUID(),
            quarry_id: quarryId,
            user_id: userId,
            review_mode: reviewMode,
            can_post_queries: options.canPostQueries,
            can_post_answers: options.canPostAnswers,
            created_by_id: options.actorUserId,
            updated_by_id: options.actorUserId,
        })
        .returning("id")
        .executeTakeFirst();

    return inserted?.id || null;
}

export async function listPostingPolicies(options: {
    quarryId?: string | null;
}) {
    const quarryId = options.quarryId || null;

    return db.selectFrom("posting_policies")
        .leftJoin("user", "user.id", "posting_policies.user_id")
        .select([
            "posting_policies.id",
            "posting_policies.quarry_id",
            "posting_policies.user_id",
            "posting_policies.review_mode",
            "posting_policies.can_post_queries",
            "posting_policies.can_post_answers",
            "posting_policies.created_at",
            "posting_policies.updated_at",
            "user.name",
            "user.displayUsername",
            "user.username",
        ])
        .where(quarryId ? "posting_policies.quarry_id" : "posting_policies.quarry_id", quarryId ? "=" : "is", quarryId)
        .orderBy("posting_policies.user_id", "asc")
        .execute();
}