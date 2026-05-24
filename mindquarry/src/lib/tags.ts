import { sql } from "kysely";

import { db } from "./db";
import { generateUUID } from "./utils";

type TagSeed = {
    name: string;
    description: string;
};

export type TagRecord = {
    id: string;
    name: string | null;
    description: string | null;
    quarry_id: string | null;
    created_by_user_id: string | null;
    is_default: boolean | null;
    created_at: Date | null;
};

export const INSTANCE_DEFAULT_TAGS: readonly TagSeed[] = [
    { name: "discussion", description: "Open-ended product or community discussion." },
    { name: "help-wanted", description: "The author is looking for direct implementation help." },
    { name: "bug", description: "Unexpected behavior or a defect report." },
    { name: "performance", description: "Performance, scaling, or latency concerns." },
    { name: "database", description: "Database modeling, queries, or migrations." },
    { name: "search", description: "Search relevance, indexing, or retrieval topics." },
    { name: "testing", description: "Unit, integration, or end-to-end testing questions." },
    { name: "authentication", description: "Auth, sessions, identity, and permissions." },
];

const GENERIC_QUARRY_TAGS: readonly TagSeed[] = [
    { name: "getting-started", description: "Entry-level questions and onboarding topics." },
    { name: "troubleshooting", description: "Debugging and problem diagnosis." },
    { name: "best-practices", description: "Recommended approaches and architecture guidance." },
];

const QUARRY_TAG_PRESETS: Record<string, readonly TagSeed[]> = {
    javascript: [
        { name: "async", description: "Promises, async flows, and event loops." },
        { name: "dom", description: "Browser APIs and document manipulation." },
        { name: "node", description: "Node.js runtime and server-side behavior." },
    ],
    typescript: [
        { name: "types", description: "Type modeling and inference." },
        { name: "generics", description: "Generic types and reusable abstractions." },
        { name: "tooling", description: "Compiler, tsconfig, and editor tooling." },
    ],
    react: [
        { name: "hooks", description: "Hook usage and component lifecycle questions." },
        { name: "state-management", description: "State ownership, transitions, and data flow." },
        { name: "rendering", description: "Rendering behavior and UI updates." },
    ],
    nextjs: [
        { name: "app-router", description: "App Router routes, layouts, and server components." },
        { name: "server-actions", description: "Server action patterns and mutations." },
        { name: "deployment", description: "Build, runtime, and deployment behavior." },
    ],
    postgres: [
        { name: "sql", description: "SQL queries, joins, and data access." },
        { name: "indexes", description: "Index design and query optimization." },
        { name: "full-text-search", description: "Text search, ranking, and extensions." },
    ],
};

function isMissingSearchFunction(error: unknown) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "42883";
}

export function normalizeTagName(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
}

export function parseTagInput(value: string) {
    return Array.from(new Set(
        value
            .split(",")
            .map((entry) => normalizeTagName(entry))
            .filter((entry) => entry.length >= 2),
    ));
}

export function getDefaultQuarryTags(quarryName: string) {
    const deduped = new Map<string, TagSeed>();
    const presetTags = QUARRY_TAG_PRESETS[normalizeTagName(quarryName)] ?? [];

    for (const seed of [...GENERIC_QUARRY_TAGS, ...presetTags]) {
        deduped.set(normalizeTagName(seed.name), seed);
    }

    return Array.from(deduped.values());
}

async function getExistingTags(quarryId: string | null) {
    if (quarryId) {
        return db.selectFrom("tags")
            .select(["id", "name"])
            .where("quarry_id", "=", quarryId)
            .execute();
    }

    return db.selectFrom("tags")
        .select(["id", "name"])
        .where("quarry_id", "is", null)
        .execute();
}

async function insertMissingDefaults(quarryId: string | null, seeds: readonly TagSeed[]) {
    if (seeds.length === 0) {
        return;
    }

    const existing = await getExistingTags(quarryId);
    const existingNames = new Set(existing.map((tag) => normalizeTagName(tag.name || "")));
    const missing = seeds.filter((seed) => !existingNames.has(normalizeTagName(seed.name)));

    if (missing.length === 0) {
        return;
    }

    await db.insertInto("tags")
        .values(missing.map((seed) => ({
            id: generateUUID(),
            name: normalizeTagName(seed.name),
            description: seed.description,
            quarry_id: quarryId,
            created_by_user_id: null,
            is_default: true,
        })))
        .onConflict((oc) => oc.doNothing())
        .execute();
}

export async function ensureInstanceDefaultTags() {
    await insertMissingDefaults(null, INSTANCE_DEFAULT_TAGS);
}

export async function ensureQuarryDefaultTags(quarryId: string, quarryName: string) {
    await ensureInstanceDefaultTags();
    await insertMissingDefaults(quarryId, getDefaultQuarryTags(quarryName));
}

export async function seedQuarryDefaultTags(quarryId: string, quarryName: string) {
    await ensureQuarryDefaultTags(quarryId, quarryName);
}

export async function getAvailableTagsForQuarry(quarryId: string, quarryName: string) {
    await ensureQuarryDefaultTags(quarryId, quarryName);

    return db.selectFrom("tags")
        .select(["id", "name", "description", "quarry_id", "created_by_user_id", "is_default", "created_at"])
        .where((eb) => eb.or([
            eb("quarry_id", "is", null),
            eb("quarry_id", "=", quarryId),
        ]))
        .orderBy(sql`case when ${sql.ref("tags.quarry_id")} is null then 0 else 1 end`)
        .orderBy("name", "asc")
        .execute();
}

export async function addQuarryTags(quarryId: string, quarryName: string, tagInput: string, createdByUserId: string) {
    await ensureQuarryDefaultTags(quarryId, quarryName);

    const nextTags = parseTagInput(tagInput);
    if (nextTags.length === 0) {
        return getAvailableTagsForQuarry(quarryId, quarryName);
    }

    const existing = await db.selectFrom("tags")
        .select(["name"])
        .where("quarry_id", "=", quarryId)
        .execute();

    const existingNames = new Set(existing.map((tag) => normalizeTagName(tag.name || "")));
    const missing = nextTags.filter((tag) => !existingNames.has(tag));

    if (missing.length > 0) {
        await db.insertInto("tags")
            .values(missing.map((tag) => ({
                id: generateUUID(),
                name: tag,
                description: `Custom tag for q/${quarryName}`,
                quarry_id: quarryId,
                created_by_user_id: createdByUserId,
                is_default: false,
            })))
            .onConflict((oc) => oc.doNothing())
            .execute();
    }

    return getAvailableTagsForQuarry(quarryId, quarryName);
}

export async function assignTagsToQuery(options: {
    queryId: string;
    quarryId: string;
    quarryName: string;
    selectedTagIds: string[];
    customTagInput?: string;
    userId: string;
    allowUserTags?: boolean;
}) {
    const availableTags = await getAvailableTagsForQuarry(options.quarryId, options.quarryName);
    const allowedIds = new Set(availableTags.map((tag) => tag.id));
    const tagIds = Array.from(new Set(options.selectedTagIds.filter((tagId) => allowedIds.has(tagId))));

    if (options.allowUserTags) {
        const customNames = parseTagInput(options.customTagInput || "");

        if (customNames.length > 0) {
            await addQuarryTags(options.quarryId, options.quarryName, customNames.join(","), options.userId);

            const refreshedTags = await getAvailableTagsForQuarry(options.quarryId, options.quarryName);
            const tagByName = new Map(refreshedTags.map((tag) => [normalizeTagName(tag.name || ""), tag.id]));

            for (const customName of customNames) {
                const tagId = tagByName.get(customName);
                if (tagId) {
                    tagIds.push(tagId);
                }
            }
        }
    }

    const uniqueTagIds = Array.from(new Set(tagIds));

    if (uniqueTagIds.length === 0) {
        return [];
    }

    await db.insertInto("query_tags")
        .values(uniqueTagIds.map((tagId) => ({ query_id: options.queryId, tag_id: tagId })))
        .onConflict((oc) => oc.doNothing())
        .execute();

    return uniqueTagIds;
}

export async function getQueryTagMap(queryIds: string[]) {
    const tagMap = new Map<string, TagRecord[]>();

    if (queryIds.length === 0) {
        return tagMap;
    }

    const rows = await db.selectFrom("query_tags")
        .innerJoin("tags", "tags.id", "query_tags.tag_id")
        .select([
            "query_tags.query_id",
            "tags.id",
            "tags.name",
            "tags.description",
            "tags.quarry_id",
            "tags.created_by_user_id",
            "tags.is_default",
            "tags.created_at",
        ])
        .where("query_tags.query_id", "in", queryIds)
        .orderBy(sql`case when ${sql.ref("tags.quarry_id")} is null then 0 else 1 end`)
        .orderBy("tags.name", "asc")
        .execute();

    for (const row of rows) {
        const existing = tagMap.get(row.query_id) || [];
        existing.push({
            id: row.id,
            name: row.name,
            description: row.description,
            quarry_id: row.quarry_id,
            created_by_user_id: row.created_by_user_id,
            is_default: row.is_default,
            created_at: row.created_at,
        });
        tagMap.set(row.query_id, existing);
    }

    return tagMap;
}

export async function searchTags(term: string) {
    const normalizedTerm = normalizeTagName(term);
    if (!normalizedTerm) {
        return [];
    }

    try {
        return await db.selectFrom("tags")
            .select(["id", "name", "description", "quarry_id", "created_by_user_id", "is_default", "created_at"])
            .where(sql<boolean>`unaccent(lower(coalesce(${sql.ref("tags.name")}, ''))) like unaccent(lower(${`%${normalizedTerm}%`}))`)
            .orderBy(sql`${sql.ref("tags.name")} <-> ${normalizedTerm}`)
            .limit(10)
            .execute();
    } catch (error) {
        if (!isMissingSearchFunction(error)) {
            throw error;
        }

        return db.selectFrom("tags")
            .select(["id", "name", "description", "quarry_id", "created_by_user_id", "is_default", "created_at"])
            .where(sql<boolean>`lower(coalesce(${sql.ref("tags.name")}, '')) like lower(${`%${normalizedTerm}%`})`)
            .orderBy("name", "asc")
            .limit(10)
            .execute();
    }
}

export async function getTaggedQueryIds(term: string) {
    const normalizedTerm = normalizeTagName(term);
    if (!normalizedTerm) {
        return [];
    }

    let rows;

    try {
        rows = await db.selectFrom("query_tags")
            .innerJoin("tags", "tags.id", "query_tags.tag_id")
            .select("query_tags.query_id")
            .where(sql<boolean>`unaccent(lower(coalesce(${sql.ref("tags.name")}, ''))) like unaccent(lower(${`%${normalizedTerm}%`}))`)
            .groupBy("query_tags.query_id")
            .execute();
    } catch (error) {
        if (!isMissingSearchFunction(error)) {
            throw error;
        }

        rows = await db.selectFrom("query_tags")
            .innerJoin("tags", "tags.id", "query_tags.tag_id")
            .select("query_tags.query_id")
            .where(sql<boolean>`lower(coalesce(${sql.ref("tags.name")}, '')) like lower(${`%${normalizedTerm}%`})`)
            .groupBy("query_tags.query_id")
            .execute();
    }

    return rows.map((row) => row.query_id);
}