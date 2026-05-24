import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sql } from "kysely";
import { VoteControls } from "@/components/vote-controls";
import { getRichTextPreview } from "@/lib/utils";
import { applyQueryVote } from "@/lib/votes";
import { revalidatePath } from "next/cache";
import { canViewQuarry, getQuarryVisibility } from "@/lib/visibility";
import { getQueryTagMap } from "@/lib/tags";
import { canAdministerQuarry, canModerateQuarry } from "@/lib/moderation";

export default async function QuarryPage({
    params,
    searchParams,
}: {
    params: Promise<{ name: string }>;
    searchParams: Promise<{ queued?: string }>;
}) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const quarryName = quarry.name;

    const membership = session?.user
        ? await db.selectFrom("quarry_members")
            .select("role")
            .where("quarry_id", "=", quarry.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst()
        : null;
    const quarryRole = membership?.role || null;
    const isQuarryAdmin = canAdministerQuarry(quarryRole);
    const canModerate = canModerateQuarry(quarryRole);

    const access = await canViewQuarry(quarry, session?.user?.id);
    if (!access.allowed) {
        if (!session?.user) {
            redirect("/login");
        }

        return (
            <div className="page-shell">
                <div className="soft-panel p-12 text-center">
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-red-500">Private Community</h1>
                    <p className="mt-4 text-muted-foreground">This Quarry is restricted. You must be a member to view its contents or participate.</p>
                </div>
            </div>
        );
    }

    async function voteQuery(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const queryId = formData.get("query_id") as string;
        const value = parseInt(formData.get("value") as string);

        if (!queryId || (value !== 1 && value !== -1)) return;

        await applyQueryVote(queryId, session.user.id, value);
        revalidatePath(`/q/${quarryName}`);
    }

    const queries = await db.selectFrom("queries")
        .leftJoin("user", "user.id", "queries.user_id")
        .leftJoin("query_views", "query_views.query_id", "queries.id")
        .select((eb) => [
            "queries.id", "queries.title", "queries.body", "queries.score",
            "queries.accepted_answer_id", "queries.created_at", "user.name", "user.displayUsername", "user.username",
            eb.fn.coalesce("query_views.views", sql<number>`0`).as("views"),
            "queries.validation_status",
            "queries.is_archived",
            eb.selectFrom("answers")
                .select("answers.body")
                .whereRef("answers.query_id", "=", "queries.id")
                .where("answers.is_hidden", "=", false)
                .where("answers.validation_status", "=", "approved")
                .orderBy("answers.created_at", "asc")
                .limit(1)
                .as("first_answer_body")
        ])
        .where("quarry_id", "=", quarry.id)
        .where("is_hidden", "=", false)
        .where("queries.validation_status", "=", "approved")
        .orderBy("created_at", "desc")
        .execute();

    const queryTagMap = await getQueryTagMap(queries.map((entry) => entry.id));

    return (
        <div className="page-shell">
            <section className="soft-panel mb-8 p-6 sm:p-8">
                {resolvedSearchParams.queued && (
                    <div className="mb-6 rounded-[20px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
                        {resolvedSearchParams.queued === "query" ? "Your query was submitted for moderator review." : "Your answer was submitted for moderator review."}
                    </div>
                )}
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Quarry</p>
                        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">q/{quarry.name}</h1>
                        <p className="mt-4 text-base leading-8 text-muted-foreground">{quarry.description}</p>
                        <div className="mt-4 inline-flex rounded-full border border-border/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {getQuarryVisibility(quarry) === "members" ? "Private" : getQuarryVisibility(quarry) === "authenticated" ? "Members" : "Public"}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 lg:items-end">
                        {session?.user && (
                            <Link href={`/q/${quarry.name}/submit`} className="soft-button-primary justify-center whitespace-nowrap px-6 py-3">
                                Submit Query
                            </Link>
                        )}
                        {isQuarryAdmin && (
                            <Link href={`/q/${quarry.name}/settings`} className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline">
                                Quarry Settings
                            </Link>
                        )}
                        {canModerate && (
                            <div className="flex flex-wrap justify-end gap-3 text-sm font-semibold text-muted-foreground">
                                <Link href={`/q/${quarry.name}/mod/queue`} className="hover:text-foreground hover:underline">Mod Queue</Link>
                                <Link href={`/q/${quarry.name}/mod/history`} className="hover:text-foreground hover:underline">Mod History</Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div className="space-y-6">
                {queries.map(q => (
                    <article key={q.id} className="soft-card relative flex gap-4 p-5">
                        {q.score !== null && q.score <= -5 && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[20px] bg-muted/88 backdrop-blur-sm font-semibold text-red-600">
                                Content minimized due to low score. Click to reveal.
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
                            {q.is_archived && (
                                <div className="mt-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-center text-xs font-semibold text-amber-700 dark:text-amber-300">
                                    Archived
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <Link href={`/q/${quarry.name}/query/${q.id}`} className="block text-xl font-semibold leading-tight text-balance hover:text-sky-600">
                                {q.title}
                            </Link>
                            {(queryTagMap.get(q.id) || []).length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(queryTagMap.get(q.id) || []).map((tag) => (
                                        <span key={tag.id} className={`rounded-full border px-3 py-1 text-xs font-semibold ${tag.quarry_id ? "border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-border/70 bg-muted/40 text-muted-foreground"}`}>
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <p className="mt-3 line-clamp-3 break-words text-sm leading-7 text-muted-foreground">
                                {getRichTextPreview(q.body || q.first_answer_body || "") || "No details provided."}
                            </p>
                            <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-3 text-xs font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                <span>{q.views} views</span>
                                <span>Asked by {q.displayUsername || q.username || q.name} on {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</span>
                            </div>
                        </div>
                    </article>
                ))}

                {queries.length === 0 && (
                    <div className="rounded-[20px] border border-dashed border-border/80 bg-card/50 p-12 text-center font-semibold text-muted-foreground">
                        No queries here yet. Be the first to ask!
                    </div>
                )}
            </div>
        </div>
    );
}
