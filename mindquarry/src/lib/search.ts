import { createHash } from "node:crypto";

import { sql } from "kysely";

import { MindQuarryConfig } from "./config";
import { db } from "./db";

export type SearchScope = "all" | "users" | "quarries" | "queries";
export type SearchSection = "users" | "quarries" | "queries";
export type SearchMode = "initial" | "more";
export type SearchResultAccess = "public" | "authenticated" | "members" | "admin";

export type SearchUserResult = {
    id: string;
    username: string | null;
    displayUsername: string | null;
    name: string | null;
    image: string | null;
    accessLevel: SearchResultAccess;
};

export type SearchQuarryResult = {
    id: string;
    name: string | null;
    description: string | null;
    visibility: string | null;
    accessLevel: SearchResultAccess;
};

export type SearchQueryResult = {
    id: string;
    title: string | null;
    body: string | null;
    score: number | null;
    accepted_answer_id: string | null;
    created_at: Date | null;
    name: string | null;
    displayUsername: string | null;
    username: string | null;
    quarry_name: string | null;
    answer_match_preview: string | null;
    accessLevel: SearchResultAccess;
};

export type SearchPage<T> = {
    items: T[];
    nextOffset: number | null;
};

export type SearchResponse = {
    scope: SearchScope;
    term: string;
    users: SearchPage<SearchUserResult>;
    quarries: SearchPage<SearchQuarryResult>;
    queries: SearchPage<SearchQueryResult>;
};

const SEARCH_SCOPE_PREFIXES: Record<string, SearchScope> = {
    u: "users",
    user: "users",
    q: "quarries",
    quarry: "quarries",
    p: "queries",
    post: "queries",
    posts: "queries",
    query: "queries",
};

function isMissingSearchFunction(error: unknown) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "42883";
}

function isMissingProfileVisibilityColumn(error: unknown) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "42703"
        && "message" in error
        && typeof error.message === "string"
        && error.message.includes("profiles.profile_visibility");
}

function isMissingQuarryVisibilityColumn(error: unknown) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "42703"
        && "message" in error
        && typeof error.message === "string"
        && error.message.includes("quarries.visibility");
}

function isMissingValidationStatusColumn(error: unknown) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "42703"
        && "message" in error
        && typeof error.message === "string"
        && error.message.includes("validation_status");
}

function buildQuarryVisibilityExpression() {
    return sql<string>`coalesce(${sql.ref("quarries.visibility")}, case when coalesce(${sql.ref("quarries.is_invite_only")}, false) then 'members' else 'public' end)`;
}

function buildUserVisibilityExpression() {
    return sql<string>`coalesce(${sql.ref("profiles.profile_visibility")}, 'public')`;
}

function buildQuarryMembershipExpression(viewerId?: string | null) {
    if (!viewerId) {
        return sql<boolean>`false`;
    }

    return sql<boolean>`exists (
        select 1 from mq_public.quarry_members qm
        where qm.quarry_id = ${sql.ref("quarries.id")}
          and qm.user_id = ${viewerId}
    )`;
}

function buildQuarryAccessCondition(viewerId?: string | null, viewerIsGlobalAdmin = false) {
    if (viewerIsGlobalAdmin) {
        return sql<boolean>`true`;
    }

    const visibility = buildQuarryVisibilityExpression();

    if (!viewerId) {
        return sql<boolean>`${visibility} = 'public'`;
    }

    const isMember = buildQuarryMembershipExpression(viewerId);

    return sql<boolean>`${visibility} = 'public'
        or ${visibility} = 'authenticated'
        or (
            ${visibility} = 'members'
            and ${isMember}
        )`;
}

function buildUserAccessCondition(viewerId?: string | null, viewerIsGlobalAdmin = false) {
    if (viewerIsGlobalAdmin) {
        return sql<boolean>`true`;
    }

    const visibility = buildUserVisibilityExpression();

    if (!viewerId) {
        return sql<boolean>`${visibility} = 'public'`;
    }

    return sql<boolean>`${sql.ref("user.id")} = ${viewerId}
        or ${visibility} = 'public'
        or ${visibility} = 'authenticated'`;
}

function normalizeQuarryVisibility(visibility?: string | null) {
    if (visibility === "authenticated" || visibility === "members") {
        return visibility;
    }

    return "public" as const;
}

function normalizeProfileVisibility(visibility?: string | null) {
    if (visibility === "authenticated" || visibility === "private") {
        return visibility;
    }

    return "public" as const;
}

export function resolveQuarrySearchAccessLevel(options: {
    visibility?: string | null;
    isMember?: boolean;
    viewerIsGlobalAdmin?: boolean;
}) {
    const visibility = normalizeQuarryVisibility(options.visibility);

    if (visibility === "members") {
        if (options.isMember) {
            return "members" satisfies SearchResultAccess;
        }

        if (options.viewerIsGlobalAdmin) {
            return "admin" satisfies SearchResultAccess;
        }
    }

    if (visibility === "authenticated") {
        return "authenticated" satisfies SearchResultAccess;
    }

    return "public" satisfies SearchResultAccess;
}

export function resolveUserSearchAccessLevel(options: {
    profileVisibility?: string | null;
    viewerIsOwner?: boolean;
    viewerIsGlobalAdmin?: boolean;
}) {
    const visibility = normalizeProfileVisibility(options.profileVisibility);

    if (options.viewerIsOwner) {
        return "authenticated" satisfies SearchResultAccess;
    }

    if (visibility === "private") {
        if (options.viewerIsGlobalAdmin) {
            return "admin" satisfies SearchResultAccess;
        }

        return null;
    }

    if (visibility === "authenticated") {
        return "authenticated" satisfies SearchResultAccess;
    }

    return "public" satisfies SearchResultAccess;
}

export function resolveQuerySearchAccessLevel(options: {
    visibility?: string | null;
    isMember?: boolean;
    isHidden?: boolean | null;
    validationStatus?: string | null;
    viewerIsGlobalAdmin?: boolean;
}) {
    const requiresAdminOverride = Boolean(options.isHidden) || Boolean(options.validationStatus && options.validationStatus !== "approved");

    if (requiresAdminOverride) {
        return options.viewerIsGlobalAdmin ? "admin" satisfies SearchResultAccess : null;
    }

    return resolveQuarrySearchAccessLevel({
        visibility: options.visibility,
        isMember: options.isMember,
        viewerIsGlobalAdmin: options.viewerIsGlobalAdmin,
    });
}

function stripWrappingQuotes(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed.slice(1, -1).trim();
    }

    return trimmed;
}

export function parseSearchInput(rawInput: string) {
    const trimmed = rawInput.trim();
    const prefixMatch = trimmed.match(/^([a-z]+)\s*:\s*(.+)$/i);

    if (!prefixMatch) {
        return {
            scope: "all" as SearchScope,
            term: stripWrappingQuotes(trimmed),
        };
    }

    const scope = SEARCH_SCOPE_PREFIXES[prefixMatch[1].toLowerCase()];
    if (!scope) {
        return {
            scope: "all" as SearchScope,
            term: stripWrappingQuotes(trimmed),
        };
    }

    return {
        scope,
        term: stripWrappingQuotes(prefixMatch[2]),
    };
}

export function buildSearchRateLimitKey(rawHeaders: Headers, userId?: string | null) {
    if (userId) {
        return createHash("sha256").update(`user:${userId}`).digest("hex");
    }

    const forwardedFor = rawHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const realIp = rawHeaders.get("x-real-ip")?.trim() ?? "";
    const userAgent = rawHeaders.get("user-agent")?.trim() ?? "";
    const fingerprintSource = [forwardedFor || realIp, userAgent].filter(Boolean).join("|") || "search:anonymous";

    return createHash("sha256").update(fingerprintSource).digest("hex");
}

function getLimitForSection(section: SearchSection, mode: SearchMode) {
    if (section === "users") {
        return mode === "initial" ? MindQuarryConfig.SEARCH.INITIAL_USERS_LIMIT : MindQuarryConfig.SEARCH.FETCH_USERS_LIMIT;
    }

    if (section === "quarries") {
        return mode === "initial" ? MindQuarryConfig.SEARCH.INITIAL_QUARRIES_LIMIT : MindQuarryConfig.SEARCH.FETCH_QUARRIES_LIMIT;
    }

    return mode === "initial" ? MindQuarryConfig.SEARCH.INITIAL_QUERIES_LIMIT : MindQuarryConfig.SEARCH.FETCH_QUERIES_LIMIT;
}

async function searchUsersWithoutProfileVisibility(term: string, offset: number, limit: number) {
    const items = await db.selectFrom("user")
        .select(["user.id", "user.username", "user.displayUsername", "user.name", "user.image"])
        .where(sql<boolean>`(
            lower(coalesce(${sql.ref("user.username")}, '')) like lower(${`%${term}%`})
            or lower(coalesce(${sql.ref("user.displayUsername")}, '')) like lower(${`%${term}%`})
            or lower(coalesce(${sql.ref("user.name")}, '')) like lower(${`%${term}%`})
        )`)
        .orderBy("user.username", "asc")
        .offset(offset)
        .limit(limit + 1)
        .execute();

    return {
        items: items.slice(0, limit).map((item) => ({ ...item, accessLevel: "public" as SearchResultAccess })),
        nextOffset: items.length > limit ? offset + limit : null,
    } satisfies SearchPage<SearchUserResult>;
}

async function searchUsers(term: string, offset: number, limit: number, viewerId?: string | null, viewerIsGlobalAdmin = false) {
    try {
        const items = await db.selectFrom("user")
            .leftJoin("profiles", "profiles.user_id", "user.id")
            .select(["user.id", "user.username", "user.displayUsername", "user.name", "user.image", "profiles.profile_visibility as profile_visibility"])
            .where(buildUserAccessCondition(viewerId, viewerIsGlobalAdmin))
            .where(sql<boolean>`(
                unaccent(lower(coalesce(${sql.ref("user.username")}, ''))) like unaccent(lower(${`%${term}%`}))
                or unaccent(lower(coalesce(${sql.ref("user.displayUsername")}, ''))) like unaccent(lower(${`%${term}%`}))
                or unaccent(lower(coalesce(${sql.ref("user.name")}, ''))) like unaccent(lower(${`%${term}%`}))
            )`)
            .orderBy(sql`greatest(
                similarity(lower(coalesce(${sql.ref("user.username")}, '')), lower(${term})),
                similarity(lower(coalesce(${sql.ref("user.displayUsername")}, '')), lower(${term})),
                similarity(lower(coalesce(${sql.ref("user.name")}, '')), lower(${term}))
            )`, "desc")
            .orderBy("user.username", "asc")
            .offset(offset)
            .limit(limit + 1)
            .execute();

        return {
            items: items.slice(0, limit).map((item) => ({
                id: item.id,
                username: item.username,
                displayUsername: item.displayUsername,
                name: item.name,
                image: item.image,
                accessLevel: resolveUserSearchAccessLevel({
                    profileVisibility: item.profile_visibility,
                    viewerIsOwner: item.id === viewerId,
                    viewerIsGlobalAdmin,
                }) || "public",
            })),
            nextOffset: items.length > limit ? offset + limit : null,
        } satisfies SearchPage<SearchUserResult>;
    } catch (error) {
        if (isMissingProfileVisibilityColumn(error)) {
            return searchUsersWithoutProfileVisibility(term, offset, limit);
        }

        if (!isMissingSearchFunction(error)) {
            throw error;
        }

        try {
            const items = await db.selectFrom("user")
                .leftJoin("profiles", "profiles.user_id", "user.id")
                .select(["user.id", "user.username", "user.displayUsername", "user.name", "user.image", "profiles.profile_visibility as profile_visibility"])
                .where(buildUserAccessCondition(viewerId, viewerIsGlobalAdmin))
                .where(sql<boolean>`(
                    lower(coalesce(${sql.ref("user.username")}, '')) like lower(${`%${term}%`})
                    or lower(coalesce(${sql.ref("user.displayUsername")}, '')) like lower(${`%${term}%`})
                    or lower(coalesce(${sql.ref("user.name")}, '')) like lower(${`%${term}%`})
                )`)
                .orderBy("user.username", "asc")
                .offset(offset)
                .limit(limit + 1)
                .execute();

            return {
                items: items.slice(0, limit).map((item) => ({
                    id: item.id,
                    username: item.username,
                    displayUsername: item.displayUsername,
                    name: item.name,
                    image: item.image,
                    accessLevel: resolveUserSearchAccessLevel({
                        profileVisibility: item.profile_visibility,
                        viewerIsOwner: item.id === viewerId,
                        viewerIsGlobalAdmin,
                    }) || "public",
                })),
                nextOffset: items.length > limit ? offset + limit : null,
            } satisfies SearchPage<SearchUserResult>;
        } catch (fallbackError) {
            if (isMissingProfileVisibilityColumn(fallbackError)) {
                return searchUsersWithoutProfileVisibility(term, offset, limit);
            }

            throw fallbackError;
        }
    }
}

async function searchQuarriesWithoutVisibility(term: string, offset: number, limit: number) {
    const items = await db.selectFrom("quarries")
        .select(["quarries.id", "quarries.name", "quarries.description"])
        .where(sql<boolean>`lower(coalesce(${sql.ref("quarries.name")}, '')) like lower(${`%${term}%`})`)
        .orderBy("quarries.name", "asc")
        .offset(offset)
        .limit(limit + 1)
        .execute();

    return {
        items: items.slice(0, limit).map((item) => ({ ...item, visibility: null, accessLevel: "public" as SearchResultAccess })),
        nextOffset: items.length > limit ? offset + limit : null,
    } satisfies SearchPage<SearchQuarryResult>;
}

async function searchQuarries(term: string, offset: number, limit: number, viewerId?: string | null, viewerIsGlobalAdmin = false) {
    try {
        const items = await db.selectFrom("quarries")
            .select([
                "quarries.id",
                "quarries.name",
                "quarries.description",
                "quarries.visibility",
                buildQuarryMembershipExpression(viewerId).as("viewer_is_member"),
            ])
            .where(buildQuarryAccessCondition(viewerId, viewerIsGlobalAdmin))
            .where(sql<boolean>`${sql.ref("quarries.name")} % ${term}`)
            .orderBy(sql`${sql.ref("quarries.name")} <-> ${term}`)
            .offset(offset)
            .limit(limit + 1)
            .execute();

        return {
            items: items.slice(0, limit).map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                visibility: item.visibility,
                accessLevel: resolveQuarrySearchAccessLevel({
                    visibility: item.visibility,
                    isMember: Boolean(item.viewer_is_member),
                    viewerIsGlobalAdmin,
                }),
            })),
            nextOffset: items.length > limit ? offset + limit : null,
        } satisfies SearchPage<SearchQuarryResult>;
    } catch (error) {
        if (isMissingQuarryVisibilityColumn(error)) {
            return searchQuarriesWithoutVisibility(term, offset, limit);
        }

        if (!isMissingSearchFunction(error)) {
            throw error;
        }

        try {
            const items = await db.selectFrom("quarries")
                .select([
                    "quarries.id",
                    "quarries.name",
                    "quarries.description",
                    "quarries.visibility",
                    buildQuarryMembershipExpression(viewerId).as("viewer_is_member"),
                ])
                .where(buildQuarryAccessCondition(viewerId, viewerIsGlobalAdmin))
                .where(sql<boolean>`lower(coalesce(${sql.ref("quarries.name")}, '')) like lower(${`%${term}%`})`)
                .orderBy("quarries.name", "asc")
                .offset(offset)
                .limit(limit + 1)
                .execute();

            return {
                items: items.slice(0, limit).map((item) => ({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    visibility: item.visibility,
                    accessLevel: resolveQuarrySearchAccessLevel({
                        visibility: item.visibility,
                        isMember: Boolean(item.viewer_is_member),
                        viewerIsGlobalAdmin,
                    }),
                })),
                nextOffset: items.length > limit ? offset + limit : null,
            } satisfies SearchPage<SearchQuarryResult>;
        } catch (fallbackError) {
            if (isMissingQuarryVisibilityColumn(fallbackError)) {
                return searchQuarriesWithoutVisibility(term, offset, limit);
            }

            throw fallbackError;
        }
    }
}

async function searchQueriesWithoutQuarryVisibility(term: string, offset: number, limit: number, viewerIsGlobalAdmin = false) {
    try {
        const items = await db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .leftJoin("quarries", "quarries.id", "queries.quarry_id")
            .select((eb) => [
                "queries.id",
                "queries.title",
                "queries.body",
                "queries.score",
                "queries.accepted_answer_id",
                "queries.created_at",
                "queries.is_hidden",
                "queries.validation_status",
                "user.name",
                "user.displayUsername",
                "user.username",
                "quarries.name as quarry_name",
                eb.selectFrom("answers")
                    .select("answers.body")
                    .whereRef("answers.query_id", "=", "queries.id")
                    .where("answers.is_hidden", "=", false)
                    .where("answers.validation_status", "=", "approved")
                    .where(sql<boolean>`lower(coalesce(${sql.ref("answers.body")}, '')) like lower(${`%${term}%`})`)
                    .limit(1)
                    .as("answer_match_preview"),
            ])
            .where(viewerIsGlobalAdmin ? sql<boolean>`true` : sql<boolean>`${sql.ref("queries.is_hidden")} = false and ${sql.ref("queries.validation_status")} = 'approved'`)
            .where(sql<boolean>`(
                lower(coalesce(${sql.ref("queries.title")}, '') || ' ' || coalesce(${sql.ref("queries.body")}, '')) like lower(${`%${term}%`})
                or exists (
                    select 1
                    from mq_public.answers answers
                    where answers.query_id = ${sql.ref("queries.id")}
                      and answers.is_hidden = false
                      and answers.validation_status = 'approved'
                      and lower(coalesce(answers.body, '')) like lower(${`%${term}%`})
                )
            )`)
            .orderBy("queries.created_at", "desc")
            .offset(offset)
            .limit(limit + 1)
            .execute();

        return {
            items: items.slice(0, limit).map((item) => ({
                id: item.id,
                title: item.title,
                body: item.body,
                score: item.score,
                accepted_answer_id: item.accepted_answer_id,
                created_at: item.created_at,
                name: item.name,
                displayUsername: item.displayUsername,
                username: item.username,
                quarry_name: item.quarry_name,
                answer_match_preview: item.answer_match_preview,
                accessLevel: resolveQuerySearchAccessLevel({
                    visibility: null,
                    isHidden: item.is_hidden,
                    validationStatus: item.validation_status,
                    viewerIsGlobalAdmin,
                }) || "public",
            })),
            nextOffset: items.length > limit ? offset + limit : null,
        } satisfies SearchPage<SearchQueryResult>;
    } catch (error) {
        if (!isMissingValidationStatusColumn(error)) {
            throw error;
        }

        return searchQueriesLegacySchema(term, offset, limit, viewerIsGlobalAdmin);
    }
}

async function searchQueriesLegacySchema(term: string, offset: number, limit: number, viewerIsGlobalAdmin = false) {
    const items = await db.selectFrom("queries")
        .leftJoin("user", "user.id", "queries.user_id")
        .leftJoin("quarries", "quarries.id", "queries.quarry_id")
        .select((eb) => [
            "queries.id",
            "queries.title",
            "queries.body",
            "queries.score",
            "queries.accepted_answer_id",
            "queries.created_at",
            "queries.is_hidden",
            "user.name",
            "user.displayUsername",
            "user.username",
            "quarries.name as quarry_name",
            eb.selectFrom("answers")
                .select("answers.body")
                .whereRef("answers.query_id", "=", "queries.id")
                .where("answers.is_hidden", "=", false)
                .where(sql<boolean>`lower(coalesce(${sql.ref("answers.body")}, '')) like lower(${`%${term}%`})`)
                .limit(1)
                .as("answer_match_preview"),
        ])
        .where(viewerIsGlobalAdmin ? sql<boolean>`true` : sql<boolean>`${sql.ref("queries.is_hidden")} = false`)
        .where(sql<boolean>`(
            lower(coalesce(${sql.ref("queries.title")}, '') || ' ' || coalesce(${sql.ref("queries.body")}, '')) like lower(${`%${term}%`})
            or exists (
                select 1
                from mq_public.answers answers
                where answers.query_id = ${sql.ref("queries.id")}
                  and answers.is_hidden = false
                  and lower(coalesce(answers.body, '')) like lower(${`%${term}%`})
            )
        )`)
        .orderBy("queries.created_at", "desc")
        .offset(offset)
        .limit(limit + 1)
        .execute();

    return {
        items: items.slice(0, limit).map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            score: item.score,
            accepted_answer_id: item.accepted_answer_id,
            created_at: item.created_at,
            name: item.name,
            displayUsername: item.displayUsername,
            username: item.username,
            quarry_name: item.quarry_name,
            answer_match_preview: item.answer_match_preview,
            accessLevel: resolveQuerySearchAccessLevel({
                visibility: null,
                isHidden: item.is_hidden,
                viewerIsGlobalAdmin,
            }) || "public",
        })),
        nextOffset: items.length > limit ? offset + limit : null,
    } satisfies SearchPage<SearchQueryResult>;
}

async function searchQueriesWithoutValidationStatus(term: string, offset: number, limit: number, viewerId?: string | null, viewerIsGlobalAdmin = false) {
    const quarryVisibility = buildQuarryAccessCondition(viewerId, viewerIsGlobalAdmin);

    try {
        const items = await db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .leftJoin("quarries", "quarries.id", "queries.quarry_id")
            .select((eb) => [
                "queries.id",
                "queries.title",
                "queries.body",
                "queries.score",
                "queries.accepted_answer_id",
                "queries.created_at",
                "queries.is_hidden",
                "user.name",
                "user.displayUsername",
                "user.username",
                "quarries.name as quarry_name",
                "quarries.visibility as quarry_visibility",
                buildQuarryMembershipExpression(viewerId).as("viewer_is_member"),
                eb.selectFrom("answers")
                    .select("answers.body")
                    .whereRef("answers.query_id", "=", "queries.id")
                    .where("answers.is_hidden", "=", false)
                    .where(sql<boolean>`to_tsvector('english', unaccent(coalesce(${sql.ref("answers.body")}, ''))) @@ websearch_to_tsquery('english', unaccent(${term}))`)
                    .limit(1)
                    .as("answer_match_preview"),
            ])
            .where(viewerIsGlobalAdmin ? sql<boolean>`true` : sql<boolean>`${sql.ref("queries.is_hidden")} = false`)
            .where(quarryVisibility)
            .where(sql<boolean>`(
                to_tsvector('english', unaccent(coalesce(${sql.ref("queries.title")}, '') || ' ' || coalesce(${sql.ref("queries.body")}, ''))) @@ websearch_to_tsquery('english', unaccent(${term}))
                or exists (
                    select 1
                    from mq_public.answers answers
                    where answers.query_id = ${sql.ref("queries.id")}
                      and answers.is_hidden = false
                      and to_tsvector('english', unaccent(coalesce(answers.body, ''))) @@ websearch_to_tsquery('english', unaccent(${term}))
                )
            )`)
            .orderBy(sql`ts_rank(
                to_tsvector('english', unaccent(coalesce(${sql.ref("queries.title")}, '') || ' ' || coalesce(${sql.ref("queries.body")}, ''))),
                websearch_to_tsquery('english', unaccent(${term}))
            )`, "desc")
            .orderBy("queries.created_at", "desc")
            .offset(offset)
            .limit(limit + 1)
            .execute();

        return {
            items: items.slice(0, limit).map((item) => ({
                id: item.id,
                title: item.title,
                body: item.body,
                score: item.score,
                accepted_answer_id: item.accepted_answer_id,
                created_at: item.created_at,
                name: item.name,
                displayUsername: item.displayUsername,
                username: item.username,
                quarry_name: item.quarry_name,
                answer_match_preview: item.answer_match_preview,
                accessLevel: resolveQuerySearchAccessLevel({
                    visibility: item.quarry_visibility,
                    isMember: Boolean(item.viewer_is_member),
                    isHidden: item.is_hidden,
                    viewerIsGlobalAdmin,
                }) || "public",
            })),
            nextOffset: items.length > limit ? offset + limit : null,
        } satisfies SearchPage<SearchQueryResult>;
    } catch (error) {
        if (isMissingQuarryVisibilityColumn(error)) {
            return searchQueriesLegacySchema(term, offset, limit, viewerIsGlobalAdmin);
        }

        if (!isMissingSearchFunction(error)) {
            throw error;
        }

        try {
            const items = await db.selectFrom("queries")
                .leftJoin("user", "user.id", "queries.user_id")
                .leftJoin("quarries", "quarries.id", "queries.quarry_id")
                .select((eb) => [
                    "queries.id",
                    "queries.title",
                    "queries.body",
                    "queries.score",
                    "queries.accepted_answer_id",
                    "queries.created_at",
                    "queries.is_hidden",
                    "user.name",
                    "user.displayUsername",
                    "user.username",
                    "quarries.name as quarry_name",
                    "quarries.visibility as quarry_visibility",
                    buildQuarryMembershipExpression(viewerId).as("viewer_is_member"),
                    eb.selectFrom("answers")
                        .select("answers.body")
                        .whereRef("answers.query_id", "=", "queries.id")
                        .where("answers.is_hidden", "=", false)
                        .where(sql<boolean>`lower(coalesce(${sql.ref("answers.body")}, '')) like lower(${`%${term}%`})`)
                        .limit(1)
                        .as("answer_match_preview"),
                ])
                .where(viewerIsGlobalAdmin ? sql<boolean>`true` : sql<boolean>`${sql.ref("queries.is_hidden")} = false`)
                .where(quarryVisibility)
                .where(sql<boolean>`(
                    lower(coalesce(${sql.ref("queries.title")}, '') || ' ' || coalesce(${sql.ref("queries.body")}, '')) like lower(${`%${term}%`})
                    or exists (
                        select 1
                        from mq_public.answers answers
                        where answers.query_id = ${sql.ref("queries.id")}
                          and answers.is_hidden = false
                          and lower(coalesce(answers.body, '')) like lower(${`%${term}%`})
                    )
                )`)
                .orderBy("queries.created_at", "desc")
                .offset(offset)
                .limit(limit + 1)
                .execute();

            return {
                items: items.slice(0, limit).map((item) => ({
                    id: item.id,
                    title: item.title,
                    body: item.body,
                    score: item.score,
                    accepted_answer_id: item.accepted_answer_id,
                    created_at: item.created_at,
                    name: item.name,
                    displayUsername: item.displayUsername,
                    username: item.username,
                    quarry_name: item.quarry_name,
                    answer_match_preview: item.answer_match_preview,
                    accessLevel: resolveQuerySearchAccessLevel({
                        visibility: item.quarry_visibility,
                        isMember: Boolean(item.viewer_is_member),
                        isHidden: item.is_hidden,
                        viewerIsGlobalAdmin,
                    }) || "public",
                })),
                nextOffset: items.length > limit ? offset + limit : null,
            } satisfies SearchPage<SearchQueryResult>;
        } catch (fallbackError) {
            if (isMissingQuarryVisibilityColumn(fallbackError)) {
                return searchQueriesLegacySchema(term, offset, limit, viewerIsGlobalAdmin);
            }

            throw fallbackError;
        }
    }
}

async function searchQueries(term: string, offset: number, limit: number, viewerId?: string | null, viewerIsGlobalAdmin = false) {
    const quarryVisibility = buildQuarryAccessCondition(viewerId, viewerIsGlobalAdmin);

    try {
        const items = await db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .leftJoin("quarries", "quarries.id", "queries.quarry_id")
            .select((eb) => [
                "queries.id",
                "queries.title",
                "queries.body",
                "queries.score",
                "queries.accepted_answer_id",
                "queries.created_at",
                "queries.is_hidden",
                "queries.validation_status",
                "user.name",
                "user.displayUsername",
                "user.username",
                "quarries.name as quarry_name",
                "quarries.visibility as quarry_visibility",
                buildQuarryMembershipExpression(viewerId).as("viewer_is_member"),
                eb.selectFrom("answers")
                    .select("answers.body")
                    .whereRef("answers.query_id", "=", "queries.id")
                    .where("answers.is_hidden", "=", false)
                    .where("answers.validation_status", "=", "approved")
                    .where(sql<boolean>`to_tsvector('english', unaccent(coalesce(${sql.ref("answers.body")}, ''))) @@ websearch_to_tsquery('english', unaccent(${term}))`)
                    .limit(1)
                    .as("answer_match_preview"),
            ])
            .where(viewerIsGlobalAdmin ? sql<boolean>`true` : sql<boolean>`${sql.ref("queries.is_hidden")} = false and ${sql.ref("queries.validation_status")} = 'approved'`)
            .where(quarryVisibility)
            .where(sql<boolean>`(
                to_tsvector('english', unaccent(coalesce(${sql.ref("queries.title")}, '') || ' ' || coalesce(${sql.ref("queries.body")}, ''))) @@ websearch_to_tsquery('english', unaccent(${term}))
                or exists (
                    select 1
                    from mq_public.answers answers
                    where answers.query_id = ${sql.ref("queries.id")}
                      and answers.is_hidden = false
                      and answers.validation_status = 'approved'
                      and to_tsvector('english', unaccent(coalesce(answers.body, ''))) @@ websearch_to_tsquery('english', unaccent(${term}))
                )
            )`)
            .orderBy(sql`ts_rank(
                to_tsvector('english', unaccent(coalesce(${sql.ref("queries.title")}, '') || ' ' || coalesce(${sql.ref("queries.body")}, ''))),
                websearch_to_tsquery('english', unaccent(${term}))
            )`, "desc")
            .orderBy("queries.created_at", "desc")
            .offset(offset)
            .limit(limit + 1)
            .execute();

        return {
            items: items.slice(0, limit).map((item) => ({
                id: item.id,
                title: item.title,
                body: item.body,
                score: item.score,
                accepted_answer_id: item.accepted_answer_id,
                created_at: item.created_at,
                name: item.name,
                displayUsername: item.displayUsername,
                username: item.username,
                quarry_name: item.quarry_name,
                answer_match_preview: item.answer_match_preview,
                accessLevel: resolveQuerySearchAccessLevel({
                    visibility: item.quarry_visibility,
                    isMember: Boolean(item.viewer_is_member),
                    isHidden: item.is_hidden,
                    validationStatus: item.validation_status,
                    viewerIsGlobalAdmin,
                }) || "public",
            })),
            nextOffset: items.length > limit ? offset + limit : null,
        } satisfies SearchPage<SearchQueryResult>;
    } catch (error) {
        if (isMissingValidationStatusColumn(error)) {
            return searchQueriesWithoutValidationStatus(term, offset, limit, viewerId, viewerIsGlobalAdmin);
        }

        if (isMissingQuarryVisibilityColumn(error)) {
            return searchQueriesWithoutQuarryVisibility(term, offset, limit, viewerIsGlobalAdmin);
        }

        if (!isMissingSearchFunction(error)) {
            throw error;
        }

        try {
            const items = await db.selectFrom("queries")
                .leftJoin("user", "user.id", "queries.user_id")
                .leftJoin("quarries", "quarries.id", "queries.quarry_id")
                .select((eb) => [
                    "queries.id",
                    "queries.title",
                    "queries.body",
                    "queries.score",
                    "queries.accepted_answer_id",
                    "queries.created_at",
                    "queries.is_hidden",
                    "queries.validation_status",
                    "user.name",
                    "user.displayUsername",
                    "user.username",
                    "quarries.name as quarry_name",
                    "quarries.visibility as quarry_visibility",
                    buildQuarryMembershipExpression(viewerId).as("viewer_is_member"),
                    eb.selectFrom("answers")
                        .select("answers.body")
                        .whereRef("answers.query_id", "=", "queries.id")
                        .where("answers.is_hidden", "=", false)
                        .where("answers.validation_status", "=", "approved")
                        .where(sql<boolean>`lower(coalesce(${sql.ref("answers.body")}, '')) like lower(${`%${term}%`})`)
                        .limit(1)
                        .as("answer_match_preview"),
                ])
                .where(viewerIsGlobalAdmin ? sql<boolean>`true` : sql<boolean>`${sql.ref("queries.is_hidden")} = false and ${sql.ref("queries.validation_status")} = 'approved'`)
                .where(quarryVisibility)
                .where(sql<boolean>`(
                    lower(coalesce(${sql.ref("queries.title")}, '') || ' ' || coalesce(${sql.ref("queries.body")}, '')) like lower(${`%${term}%`})
                    or exists (
                        select 1
                        from mq_public.answers answers
                        where answers.query_id = ${sql.ref("queries.id")}
                          and answers.is_hidden = false
                          and answers.validation_status = 'approved'
                          and lower(coalesce(answers.body, '')) like lower(${`%${term}%`})
                    )
                )`)
                .orderBy("queries.created_at", "desc")
                .offset(offset)
                .limit(limit + 1)
                .execute();

            return {
                items: items.slice(0, limit).map((item) => ({
                    id: item.id,
                    title: item.title,
                    body: item.body,
                    score: item.score,
                    accepted_answer_id: item.accepted_answer_id,
                    created_at: item.created_at,
                    name: item.name,
                    displayUsername: item.displayUsername,
                    username: item.username,
                    quarry_name: item.quarry_name,
                    answer_match_preview: item.answer_match_preview,
                    accessLevel: resolveQuerySearchAccessLevel({
                        visibility: item.quarry_visibility,
                        isMember: Boolean(item.viewer_is_member),
                        isHidden: item.is_hidden,
                        validationStatus: item.validation_status,
                        viewerIsGlobalAdmin,
                    }) || "public",
                })),
                nextOffset: items.length > limit ? offset + limit : null,
            } satisfies SearchPage<SearchQueryResult>;
        } catch (fallbackError) {
            if (isMissingValidationStatusColumn(fallbackError)) {
                return searchQueriesWithoutValidationStatus(term, offset, limit, viewerId, viewerIsGlobalAdmin);
            }

            if (isMissingQuarryVisibilityColumn(fallbackError)) {
                return searchQueriesWithoutQuarryVisibility(term, offset, limit, viewerIsGlobalAdmin);
            }

            throw fallbackError;
        }
    }
}

export async function runSearch(options: {
    rawQuery: string;
    viewerId?: string | null;
    viewerIsGlobalAdmin?: boolean;
    mode: SearchMode;
    section?: SearchSection | null;
    offset?: number;
}) {
    const parsed = parseSearchInput(options.rawQuery);
    const term = parsed.term.trim();

    if (!term) {
        return {
            scope: parsed.scope,
            term,
            users: { items: [], nextOffset: null },
            quarries: { items: [], nextOffset: null },
            queries: { items: [], nextOffset: null },
        } satisfies SearchResponse;
    }

    const targetSection = options.section || (parsed.scope === "all" ? null : parsed.scope);
    const offset = Math.max(0, options.offset || 0);

    if (targetSection === "users") {
        return {
            scope: parsed.scope,
            term,
            users: await searchUsers(term, offset, getLimitForSection("users", options.mode), options.viewerId, options.viewerIsGlobalAdmin),
            quarries: { items: [], nextOffset: null },
            queries: { items: [], nextOffset: null },
        } satisfies SearchResponse;
    }

    if (targetSection === "quarries") {
        return {
            scope: parsed.scope,
            term,
            users: { items: [], nextOffset: null },
            quarries: await searchQuarries(term, offset, getLimitForSection("quarries", options.mode), options.viewerId, options.viewerIsGlobalAdmin),
            queries: { items: [], nextOffset: null },
        } satisfies SearchResponse;
    }

    if (targetSection === "queries") {
        return {
            scope: parsed.scope,
            term,
            users: { items: [], nextOffset: null },
            quarries: { items: [], nextOffset: null },
            queries: await searchQueries(term, offset, getLimitForSection("queries", options.mode), options.viewerId, options.viewerIsGlobalAdmin),
        } satisfies SearchResponse;
    }

    const [users, quarries, queries] = await Promise.all([
        searchUsers(term, 0, getLimitForSection("users", options.mode), options.viewerId, options.viewerIsGlobalAdmin),
        searchQuarries(term, 0, getLimitForSection("quarries", options.mode), options.viewerId, options.viewerIsGlobalAdmin),
        searchQueries(term, 0, getLimitForSection("queries", options.mode), options.viewerId, options.viewerIsGlobalAdmin),
    ]);

    return {
        scope: parsed.scope,
        term,
        users,
        quarries,
        queries,
    } satisfies SearchResponse;
}