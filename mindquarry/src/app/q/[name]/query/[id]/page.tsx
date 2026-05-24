import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUUID } from "@/lib/utils";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { CopyLinkButton } from "./CopyLinkButton";
import { TipTapRenderer } from "@/components/TipTapRenderer";
import { isRateLimited } from "@/lib/rateLimit";
import { sql } from "kysely";
import { SubmitAnswerForm } from "./SubmitAnswerForm";
import { hasRichTextContent } from "@/lib/utils";
import { applyAnswerVote, applyQueryVote } from "@/lib/votes";
import { VoteControls } from "@/components/vote-controls";
import { canViewQuarry } from "@/lib/visibility";
import { notifyMentions, notifyQuerySubscribers, refreshProfileMetrics, subscribeUserToQuery, unsubscribeUserFromQuery } from "@/lib/notifications";
import { MindQuarryConfig } from "@/lib/config";
import { recordQueryView } from "@/lib/queryViews";
import { getQueryTagMap } from "@/lib/tags";

type SubmitAnswerResult = {
    ok: boolean;
    error?: string;
};

export default async function QueryDiscussionPage({ params }: { params: Promise<{ name: string, id: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").select(["id", "name", "is_invite_only", "visibility"]).where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const membership = session?.user
        ? await db.selectFrom("quarry_members")
            .select("role")
            .where("quarry_id", "=", quarry.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst()
        : null;
    const isQuarryAdmin = membership?.role === "admin";

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

    const subscription = session?.user
        ? await db.selectFrom("query_subscriptions")
            .select("user_id")
            .where("query_id", "=", resolvedParams.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst()
        : null;

    const query = await db.selectFrom("queries")
        .leftJoin("user", "user.id", "queries.user_id")
        .leftJoin("query_views", "query_views.query_id", "queries.id")
        .select((eb) => [
            "queries.id", "queries.title", "queries.body", "queries.score",
            "queries.accepted_answer_id", "queries.created_at", "queries.user_id as author_id", "user.name", "user.displayUsername", "user.username",
            eb.fn.coalesce("query_views.views", sql<number>`0`).as("views")
        ])
        .where("queries.id", "=", resolvedParams.id)
        .where("is_hidden", "=", false)
        .executeTakeFirst();

    if (!query) return notFound();

    const queryTagMap = await getQueryTagMap([query.id]);
    const queryTags = queryTagMap.get(query.id) || [];

    const answers = await db.selectFrom("answers")
        .leftJoin("user", "user.id", "answers.user_id")
        .select([
            "answers.id", "answers.body", "answers.score", "answers.parent_answer_id",
            "answers.created_at", "answers.user_id as author_id", "user.name", "user.displayUsername", "user.username"
        ])
        .where("query_id", "=", query.id)
        .where("is_hidden", "=", false)
        .orderBy("score", "desc")
        .orderBy("created_at", "asc")
        .execute();

    void recordQueryView({
        queryId: query.id,
        rawHeaders,
        userId: session?.user?.id,
    }).catch(() => null);

    async function submitAnswer(formData: FormData): Promise<SubmitAnswerResult> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            redirect("/login");
        }

        const replyRateLimit = MindQuarryConfig.FORUM.MAX_REPLIES_PER_MIN;
        const rateLimitWindowMs = MindQuarryConfig.RATE_LIMIT_WINDOW_MS;

        if (isRateLimited(session.user.id, "submit_answer", replyRateLimit, rateLimitWindowMs)) {
            console.warn(`User ${session.user.id} rate limited on answer submission.`);
            return { ok: false, error: "You are posting too quickly. Try again in a moment." };
        }

        const body = formData.get("body") as string;
        const parentId = formData.get("parent_id") as string | null;

        if (!hasRichTextContent(body)) {
            return { ok: false, error: "Answer cannot be empty." };
        }

        try {
            const parentAnswer = parentId
                ? await db.selectFrom("answers").select(["id", "user_id"]).where("id", "=", parentId).executeTakeFirst()
                : null;

            const answer = await db.insertInto("answers").values({
                id: generateUUID(),
                query_id: query!.id,
                user_id: session.user.id,
                body,
                parent_answer_id: parentId ? parentId : null,
            }).returning("id").executeTakeFirst();

            if (answer) {
                const href = `/q/${quarry!.name}/query/${query!.id}#answer-${answer.id}`;

                await subscribeUserToQuery(query!.id, session.user.id, "answer");
                await notifyQuerySubscribers({
                    queryId: query!.id,
                    actorUserId: session.user.id,
                    href,
                    title: `${session.user.name || "Someone"} replied in ${query!.title || "a thread"}`,
                    body,
                    answerId: answer.id,
                    explicitRecipientIds: parentAnswer?.user_id ? [parentAnswer.user_id] : [],
                });
                await notifyMentions({
                    actorUserId: session.user.id,
                    content: body,
                    href,
                    title: `${session.user.name || "Someone"} mentioned you in ${query!.title || "a thread"}`,
                    queryId: query!.id,
                    answerId: answer.id,
                });
            }

            await refreshProfileMetrics(session.user.id);
            revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
            return { ok: true };
        } catch (error) {
            console.error("Failed to submit answer", error);
            return { ok: false, error: "Failed to submit answer." };
        }
    }

    async function toggleSubscription() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            redirect("/login");
        }

        const currentSubscription = await db.selectFrom("query_subscriptions")
            .select("user_id")
            .where("query_id", "=", query!.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst();

        if (currentSubscription) {
            await unsubscribeUserFromQuery(query!.id, session.user.id);
        } else {
            await subscribeUserToQuery(query!.id, session.user.id, "manual");
        }

        revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
    }

    async function acceptAnswer(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        if (session.user.id !== query!.author_id) return; // Only author can accept

        const answerId = formData.get("answer_id") as string;
        if (!answerId) return;

        // Toggle logic: if already accepted, unaccept it.
        const currentAccept = query!.accepted_answer_id;
        if (currentAccept === answerId) {
            await db.updateTable("queries").set({ accepted_answer_id: null }).where("id", "=", query!.id).execute();
        } else {
            await db.updateTable("queries").set({ accepted_answer_id: answerId }).where("id", "=", query!.id).execute();
        }

        revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
    }

    async function voteQuery(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return redirect("/login");

        const value = parseInt(formData.get("value") as string);
        if (value !== 1 && value !== -1) return;

        try {
            await applyQueryVote(query!.id, session.user.id, value);
            revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
        } catch (error) {
            console.error("Failed to vote on query", error);
        }
    }

    async function voteAnswer(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return redirect("/login");

        const answerId = formData.get("answer_id") as string;
        const value = parseInt(formData.get("value") as string);

        if (!answerId || (value !== 1 && value !== -1)) return;

        try {
            await applyAnswerVote(answerId, session.user.id, value);
            revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
        } catch (error) {
            console.error("Failed to vote on answer", error);
        }
    }

    const buildQuotedReply = (body: string | null) => `<blockquote>${body || "<p></p>"}</blockquote><p></p>`;

    const renderAnswers = (parentId: string | null = null, depth = 0) => {
        const filtered = answers.filter(a => a.parent_answer_id === parentId);
        if (filtered.length === 0) return null;

        return (
            <div className={`space-y-4 ${depth > 0 ? "ml-6 border-l border-border/70 pl-4" : "mt-8"}`}>
                {filtered.map(a => (
                    <article key={a.id} id={`answer-${a.id}`} className="soft-card p-5">
                        <div className="flex gap-4">
                            <div className="min-w-[58px] rounded-[18px] border border-border/70 bg-muted/30 p-2">
                                <VoteControls score={a.score} action={voteAnswer} fields={{ answer_id: a.id }} compact />
                                {query.accepted_answer_id === a.id && (
                                    <div className="mt-2 rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-center text-xs font-semibold text-green-600">Accepted</div>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="mb-2 flex flex-col gap-2 text-xs font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                    <span>{a.displayUsername || a.username || a.name} • {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</span>
                                    <div className="flex gap-2">
                                        <CopyLinkButton answerId={a.id} />
                                        <label htmlFor={`collapse-${a.id}`} className="soft-button cursor-pointer rounded-full px-3 py-1 text-xs">
                                            +/-
                                        </label>
                                    </div>
                                </div>

                                <input type="checkbox" id={`collapse-${a.id}`} className="peer hidden" />

                                <div className="peer-checked:hidden">
                                    <div className="text-sm">
                                        <TipTapRenderer content={a.body || ""} />
                                    </div>

                                    <div className="mt-4 flex items-center gap-4 border-t border-border/70 pt-4 text-sm font-semibold">
                                        {session?.user && (
                                            <details className="w-full">
                                                <summary className="inline-flex cursor-pointer list-none text-sky-600 hover:underline">
                                                    Reply / Quote
                                                </summary>
                                                <div className="mt-4">
                                                    <SubmitAnswerForm
                                                        parentId={a.id}
                                                        defaultBody={buildQuotedReply(a.body)}
                                                        submitAction={submitAnswer}
                                                    />
                                                </div>
                                            </details>
                                        )}
                                        {session?.user?.id === query.author_id && (
                                            <form action={acceptAnswer}>
                                                <input type="hidden" name="answer_id" value={a.id} />
                                                <button type="submit" className="cursor-pointer text-green-600 hover:underline">
                                                    {query.accepted_answer_id === a.id ? "Unaccept" : "Accept"}
                                                </button>
                                            </form>
                                        )}
                                    </div>


                                </div>
                            </div>
                        </div>
                        <div className="peer-checked:hidden">
                            {renderAnswers(a.id, depth + 1)}
                        </div>
                    </article>
                ))}
            </div>
        );
    };

    return (
        <div className="page-shell max-w-5xl">
            <Link href={`/q/${quarry.name}`} className="soft-button mb-4 gap-2 rounded-full px-4 py-2">&larr; Back to q/{quarry.name}</Link>

            <section className="soft-panel relative flex gap-6 p-6 sm:p-8">
                {query.score !== null && query.score <= MindQuarryConfig.FORUM.MIN_SCORE_VISIBILITY && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[24px] bg-muted/95 backdrop-blur-md text-red-600">
                        <span className="mb-4 text-xl font-semibold uppercase tracking-[0.14em]">Hidden due to low score ({MindQuarryConfig.FORUM.MIN_SCORE_VISIBILITY} or below)</span>
                        <label htmlFor="reveal-query" className="soft-button cursor-pointer px-6 py-2">
                            Reveal Anyway
                        </label>
                    </div>
                )}
                <input type="checkbox" id="reveal-query" className="peer hidden" />

                <div className="rounded-[18px] border border-border/70 bg-muted/30 p-3 peer-checked:[&~div]:!opacity-100">
                    <VoteControls score={query.score} action={voteQuery} />
                </div>
                <div className="flex-1 peer-checked:opacity-100">
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">{query.title}</h1>
                    {queryTags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {queryTags.map((tag) => (
                                <span key={tag.id} className={`rounded-full border px-3 py-1 text-xs font-semibold ${tag.quarry_id ? "border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-border/70 bg-muted/40 text-muted-foreground"}`}>
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="mb-6 flex flex-col gap-3 border-b border-border/70 pb-4 pt-4 text-sm font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>Asked by {query.displayUsername || query.username || query.name} on {query.created_at ? new Date(query.created_at).toLocaleDateString() : ''} • {query.views} views</span>
                        <div className="flex items-center gap-3">
                            {session?.user && (
                                <form action={toggleSubscription}>
                                    <button type="submit" className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:border-sky-400/70 hover:text-sky-600">
                                        {subscription ? "Unfollow Thread" : "Follow Thread"}
                                    </button>
                                </form>
                            )}
                            {isQuarryAdmin && <Link href={`/q/${quarry.name}/mod/queue`} className="text-sky-600 hover:underline">Mod Queue</Link>}
                            <Link href={`/q/${quarry.name}/query/${query.id}/report`} className="text-red-500 hover:underline">Report</Link>
                        </div>
                    </div>
                    <div className="text-lg">
                        <TipTapRenderer content={query.body || ""} />
                    </div>
                </div>
            </section>

            <h2 className="font-display mt-12 border-b border-border/70 pb-3 text-2xl font-semibold tracking-tight">{answers.length} Answers</h2>

            {renderAnswers()}

            {session?.user && (
                <div className="soft-panel mt-12 p-6 sm:p-8">
                    <h3 className="font-display mb-4 text-2xl font-semibold tracking-tight">Your Answer</h3>
                    <SubmitAnswerForm submitAction={submitAnswer} />
                </div>
            )}

        </div>
    );
}
