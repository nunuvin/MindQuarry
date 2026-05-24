import { db } from "@/lib/db";
import Link from "next/link";
import { sql } from "kysely";
import { getRichTextPreview } from "@/lib/utils";
import { getQueryTagMap, getTaggedQueryIds, searchTags } from "@/lib/tags";

function isMissingSearchFunction(error: unknown) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "42883";
}

async function loadQuarryResults(query: string) {
    try {
        return await db.selectFrom("quarries")
            .selectAll()
            .where(sql<boolean>`${sql.ref('name')} % ${query}`)
            .orderBy(sql`${sql.ref('name')} <-> ${query}`)
            .limit(5)
            .execute();
    } catch (error) {
        if (!isMissingSearchFunction(error)) {
            throw error;
        }

        return db.selectFrom("quarries")
            .selectAll()
            .where(sql<boolean>`lower(coalesce(${sql.ref('name')}, '')) like lower(${`%${query}%`})`)
            .orderBy("name", "asc")
            .limit(5)
            .execute();
    }
}

async function loadQueryResults(query: string, taggedQueryIds: string[]) {
    try {
        return await db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .leftJoin("quarries", "quarries.id", "queries.quarry_id")
            .select([
                "queries.id", "queries.title", "queries.body", "queries.score",
                "queries.accepted_answer_id", "queries.created_at", "user.name", "user.displayUsername", "user.username",
                "quarries.name as quarry_name"
            ])
            .where("queries.is_hidden", "=", false)
            .where(taggedQueryIds.length > 0
                ? sql<boolean>`to_tsvector('english', unaccent(${sql.ref('queries.title')} || ' ' || ${sql.ref('queries.body')})) @@ websearch_to_tsquery('english', unaccent(${query})) or ${sql.ref('queries.id')} in (${sql.join(taggedQueryIds)})`
                : sql<boolean>`to_tsvector('english', unaccent(${sql.ref('queries.title')} || ' ' || ${sql.ref('queries.body')})) @@ websearch_to_tsquery('english', unaccent(${query}))`)
            .orderBy(sql`ts_rank(to_tsvector('english', unaccent(${sql.ref('queries.title')} || ' ' || ${sql.ref('queries.body')})), websearch_to_tsquery('english', unaccent(${query})))`, "desc")
            .limit(20)
            .execute();
    } catch (error) {
        if (!isMissingSearchFunction(error)) {
            throw error;
        }

        return db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .leftJoin("quarries", "quarries.id", "queries.quarry_id")
            .select([
                "queries.id", "queries.title", "queries.body", "queries.score",
                "queries.accepted_answer_id", "queries.created_at", "user.name", "user.displayUsername", "user.username",
                "quarries.name as quarry_name"
            ])
            .where("queries.is_hidden", "=", false)
            .where(taggedQueryIds.length > 0
                ? sql<boolean>`lower(coalesce(${sql.ref('queries.title')}, '') || ' ' || coalesce(${sql.ref('queries.body')}, '')) like lower(${`%${query}%`}) or ${sql.ref('queries.id')} in (${sql.join(taggedQueryIds)})`
                : sql<boolean>`lower(coalesce(${sql.ref('queries.title')}, '') || ' ' || coalesce(${sql.ref('queries.body')}, '')) like lower(${`%${query}%`})`)
            .orderBy("queries.created_at", "desc")
            .limit(20)
            .execute();
    }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const resolvedParams = await searchParams;
    const query = resolvedParams.q || "";
    const matchingTags = query ? await searchTags(query) : [];
    const taggedQueryIds = query ? await getTaggedQueryIds(query) : [];

    const quarryResults = query ? await loadQuarryResults(query) : [];

    const results = query ? await loadQueryResults(query, taggedQueryIds) : [];

    const queryTagMap = await getQueryTagMap(results.map((entry) => entry.id));

    return (
        <div className="max-w-5xl mx-auto mt-8 p-4">
            <h1 className="text-3xl font-black uppercase tracking-tight mb-8 border-b-[3px] border-black dark:border-white pb-2">Search Results</h1>

            <form action="/search" method="GET" className="mb-12 flex gap-4">
                <input type="search" name="q" defaultValue={query} className="flex-1 p-4 border-[3px] border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg" placeholder="Search queries..." />
                <button type="submit" className="px-8 bg-black text-white dark:bg-white dark:text-black font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none transition-all">
                    Search
                </button>
            </form>

            {!query && (
                <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                    Enter a term to search the platform.
                </div>
            )}

            {query && quarryResults.length > 0 && (
                <div className="mb-12">
                    <h2 className="font-black uppercase mb-4 text-muted-foreground">Communities found</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quarryResults.map(q => (
                            <Link href={`/q/${q.name}`} key={q.id} className="p-4 border-2 border-black dark:border-white bg-card shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] hover:-translate-y-1 transition-transform">
                                <h3 className="font-bold text-lg text-blue-500">q/{q.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-1">{q.description}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {query && matchingTags.length > 0 && (
                <div className="mb-12">
                    <h2 className="font-black uppercase mb-4 text-muted-foreground">Matching tags</h2>
                    <div className="flex flex-wrap gap-3">
                        {matchingTags.map((tag) => (
                            <span key={tag.id} className={`rounded-full border px-4 py-2 text-sm font-bold ${tag.quarry_id ? "border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-black dark:border-white bg-card"}`}>
                                #{tag.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {query && (
                <div className="space-y-6">
                    <h2 className="font-black uppercase mb-4 text-muted-foreground">Posts found</h2>
                    {results.map(q => (
                        <div key={q.id} className="p-4 border-[3px] border-black dark:border-white flex gap-4 bg-card">
                            <div className="flex flex-col items-center justify-start min-w-[60px] p-2 bg-muted/30">
                                <span className="font-black text-lg">{q.score}</span>
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-bold mb-1 text-blue-500">
                                    q/{q.quarry_name}
                                </div>
                                <Link href={`/q/${q.quarry_name}/query/${q.id}`} className="text-xl font-bold hover:underline mb-2 block line-clamp-2">
                                    {q.title}
                                </Link>
                                {(queryTagMap.get(q.id) || []).length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {(queryTagMap.get(q.id) || []).map((tag) => (
                                            <span key={tag.id} className={`rounded-full border px-3 py-1 text-xs font-semibold ${tag.quarry_id ? "border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-border/70 bg-muted/40 text-muted-foreground"}`}>
                                                {tag.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-muted-foreground line-clamp-3 text-sm mb-4 break-words">
                                    {getRichTextPreview(q.body || "") || "No details provided."}
                                </p>
                            </div>
                        </div>
                    ))}

                    {results.length === 0 && quarryResults.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                            No results found for <span className="font-semibold">{query}</span>.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
