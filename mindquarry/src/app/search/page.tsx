import { db } from "@/lib/db";
import Link from "next/link";
import { sql } from "kysely";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const resolvedParams = await searchParams;
    const query = resolvedParams.q || "";

    let results: any[] = [];
    let quarryResults: any[] = [];

    if (query) {
        // Find quarries via fuzzy match (pg_trgm)
        quarryResults = await db.selectFrom("quarries")
            .selectAll()
            .where(sql<boolean>`${sql.ref('name')} % ${query}`) // Uses pg_trgm % operator
            .orderBy(sql`${sql.ref('name')} <-> ${query}`) // strict distance order
            .limit(5)
            .execute();

        // Find queries via Full Text Search
        results = await db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .leftJoin("quarries", "quarries.id", "queries.quarry_id")
            .select([
                "queries.id", "queries.title", "queries.body", "queries.score", "queries.views",
                "queries.accepted_answer_id", "queries.created_at", "user.name", "user.displayUsername", "user.username",
                "quarries.name as quarry_name"
            ])
            .where("queries.is_hidden", "=", false)
            .where(sql<boolean>`to_tsvector('english', unaccent(${sql.ref('queries.title')} || ' ' || ${sql.ref('queries.body')})) @@ websearch_to_tsquery('english', unaccent(${query}))`)
            .orderBy(sql`ts_rank(to_tsvector('english', unaccent(${sql.ref('queries.title')} || ' ' || ${sql.ref('queries.body')})), websearch_to_tsquery('english', unaccent(${query})))`, "desc")
            .limit(20)
            .execute();
    }

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
                                <p className="text-muted-foreground line-clamp-2 text-sm mb-4">
                                    {q.body}
                                </p>
                            </div>
                        </div>
                    ))}

                    {results.length === 0 && quarryResults.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                            No results found for "{query}".
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
