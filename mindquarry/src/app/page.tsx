import { db } from "@/lib/db";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "kysely";
import { VoteControls } from "@/components/vote-controls";
import HomeInfoRail from "./HomeInfoRail";
import { MindQuarryConfig } from "@/lib/config";
import { getRichTextPreview } from "@/lib/utils";
import { applyQueryVote } from "@/lib/votes";
import { revalidatePath } from "next/cache";
import { isGlobalAdmin } from "@/lib/admin";

export default async function Home({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    const viewerIsGlobalAdmin = session?.user?.id ? await isGlobalAdmin(session.user.id) : false;
    const resolvedParams = await searchParams;
    const sort = resolvedParams.sort === "top" ? "top" : "new";
    const feedFollowingLimit = MindQuarryConfig.FORUM.FEED_FOLLOWING_LIMIT;
    const feedQueryLimit = MindQuarryConfig.FORUM.FEED_QUERY_LIMIT;
    const minScoreVisibility = MindQuarryConfig.FORUM.MIN_SCORE_VISIBILITY;

    async function voteQuery(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const queryId = formData.get("query_id") as string;
        const value = parseInt(formData.get("value") as string);

        if (!queryId || (value !== 1 && value !== -1)) return;

        await applyQueryVote(queryId, session.user.id, value);
        revalidatePath("/");
    }

    let followFeedQuery = null;
    if (session?.user) {
        followFeedQuery = db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .leftJoin("quarries", "quarries.id", "queries.quarry_id")
            .leftJoin("query_views", "query_views.query_id", "queries.id")
            .innerJoin("follows", "follows.following_id", "queries.user_id")
            .select((eb) => [
                "queries.id", "queries.title", "queries.body", "queries.score",
                "queries.accepted_answer_id", "queries.created_at", "user.name", "user.displayUsername", "user.username",
                "quarries.name as quarry_name",
                eb.fn.coalesce("query_views.views", sql<number>`0`).as("views")
            ])
            .where("follows.follower_id", "=", session.user.id)
            .where("queries.is_hidden", "=", false)
            .orderBy("queries.created_at", "desc")
            .limit(feedFollowingLimit);
    }

    let queriesQuery = db.selectFrom("queries")
        .leftJoin("user", "user.id", "queries.user_id")
        .leftJoin("quarries", "quarries.id", "queries.quarry_id")
        .leftJoin("query_views", "query_views.query_id", "queries.id")
        .select((eb) => [
            "queries.id", "queries.title", "queries.body", "queries.score",
            "queries.accepted_answer_id", "queries.created_at", "user.name", "user.displayUsername", "user.username",
            "quarries.name as quarry_name",
            eb.fn.coalesce("query_views.views", sql<number>`0`).as("views")
        ])
        .where("queries.is_hidden", "=", false);

    if (sort === "top") {
        queriesQuery = queriesQuery.orderBy("queries.score", "desc").orderBy("queries.created_at", "desc");
    } else {
        queriesQuery = queriesQuery.orderBy("queries.created_at", "desc");
    }

    // Parallelize both feed queries to save connection time and latency
    const [followFeed, queries] = await Promise.all([
        followFeedQuery ? followFeedQuery.execute() : Promise.resolve([]),
        queriesQuery.limit(feedQueryLimit).execute()
    ]);

    return (
        <div className="page-shell grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
                {followFeed.length > 0 && (
                    <section className="soft-panel p-6">
                        <div className="mb-4 flex items-center justify-between gap-4 border-b border-border/70 pb-3">
                            <div>
                                <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Following</p>
                                <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">From Your Network</h2>
                            </div>
                            <p className="max-w-xs text-sm text-muted-foreground">Recent questions from people you already follow, without leaving the main feed.</p>
                        </div>
                        <div className="flex snap-x gap-4 overflow-x-auto pb-2">
                            {followFeed.map(fq => (
                                <Link href={`/q/${fq.quarry_name}/query/${fq.id}`} key={fq.id} className="soft-card snap-start w-[290px] shrink-0 p-5">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">q/{fq.quarry_name}</div>
                                    <h3 className="mt-3 text-lg font-semibold leading-tight text-balance">{fq.title}</h3>
                                    {getRichTextPreview(fq.body || "", 120) && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{getRichTextPreview(fq.body || "", 120)}</p>}
                                    <div className="mt-4 text-xs font-semibold text-muted-foreground">By {fq.displayUsername || fq.username || fq.name}</div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <section className="soft-panel p-6">
                    <div className="border-b border-border/70 pb-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Discovery</div>
                            <div className="flex gap-2">
                                <Link href="/?sort=new" className={sort === "new" ? "soft-button-primary" : "soft-button"}>New</Link>
                                <Link href="/?sort=top" className={sort === "top" ? "soft-button-primary" : "soft-button"}>Top</Link>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">Main Feed</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Browse new questions, follow score shifts, and scan previews without the heavier brutalist framing from the earlier pass.</p>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {queries.map(q => (
                            <article key={q.id} className="soft-card relative flex gap-4 p-5">
                                {q.score !== null && q.score <= minScoreVisibility && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[20px] bg-muted/92 backdrop-blur-sm font-semibold text-red-600">
                                        Hidden due to low score.
                                    </div>
                                )}
                                <div className="rounded-[18px] border border-border/70 bg-muted/30 p-3">
                                    <VoteControls score={q.score} action={voteQuery} fields={{ query_id: q.id }} compact />
                                    <span className="mt-1 block text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Votes</span>
                                    {q.accepted_answer_id && (
                                        <div className="mt-2 rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-center text-xs font-semibold text-green-600">
                                            Accepted
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
                                        <Link href={`/q/${q.quarry_name}`}>q/{q.quarry_name}</Link>
                                    </div>
                                    <Link href={`/q/${q.quarry_name}/query/${q.id}`} className="mt-2 block text-xl font-semibold leading-tight text-balance hover:text-sky-600">
                                        {q.title}
                                    </Link>
                                    {getRichTextPreview(q.body || "") && (
                                        <p className="mt-3 line-clamp-3 break-words text-sm leading-7 text-muted-foreground">
                                            {getRichTextPreview(q.body || "")}
                                        </p>
                                    )}
                                    <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-3 text-xs font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                        <span>{q.views} views</span>
                                        <span>Asked by {q.displayUsername || q.username || q.name} on {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</span>
                                    </div>
                                </div>
                            </article>
                        ))}

                        {queries.length === 0 && (
                            <div className="rounded-[20px] border border-dashed border-border/80 bg-card/50 p-12 text-center text-muted-foreground">
                                The feed is empty.
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <HomeInfoRail showInstanceAdminLink={viewerIsGlobalAdmin} />
        </div>
    );
}
