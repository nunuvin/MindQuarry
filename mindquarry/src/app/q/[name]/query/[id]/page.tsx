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
import { SubmitQueryForm } from "../../submit/SubmitQueryForm";
import { hasRichTextContent } from "@/lib/utils";
import { normalizeMentionContent } from "@/lib/mentions";
import { applyAnswerVote, applyQueryVote } from "@/lib/votes";
import { VoteControls } from "@/components/vote-controls";
import { canViewQuarry } from "@/lib/visibility";
import { notifyMentions, notifyQuerySubscribers, refreshProfileMetrics, subscribeUserToQuery, unsubscribeUserFromQuery } from "@/lib/notifications";
import { MindQuarryConfig } from "@/lib/config";
import { recordQueryView } from "@/lib/queryViews";
import { getAvailableTagsForQuarry, getQueryTagMap, replaceTagsForQuery } from "@/lib/tags";
import { canAdministerQuarry, canModerateQuarry, getEffectivePostingPolicy, shouldReviewAnswer } from "@/lib/moderation";
import { deleteAnswerByAuthor, deleteQuery, setQueryArchived, updateAnswerByAuthor, updateQueryByAuthor } from "@/lib/content";
import { isGlobalAdmin } from "@/lib/admin";
import { ChevronDown, ChevronUp, Ellipsis } from "lucide-react";

type SubmitAnswerResult = {
    ok: boolean;
    error?: string;
};

type SubmitQueryResult = {
    ok: boolean;
    error?: string;
};

export default async function QueryDiscussionPage({
    params,
    searchParams,
}: {
    params: Promise<{ name: string, id: string }>;
    searchParams?: Promise<{ queued?: string }>;
}) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    const viewerIsGlobalAdmin = session?.user?.id ? await isGlobalAdmin(session.user.id) : false;

    const resolvedParams = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};

    const quarry = await db.selectFrom("quarries").select(["id", "name", "is_invite_only", "visibility", "allow_user_tags"]).where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const membership = session?.user
        ? await db.selectFrom("quarry_members")
            .select("role")
            .where("quarry_id", "=", quarry.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst()
        : null;
    const quarryRole = membership?.role || null;
    const isQuarryAdmin = canAdministerQuarry(quarryRole, viewerIsGlobalAdmin);
    const canModerate = canModerateQuarry(quarryRole, viewerIsGlobalAdmin);

    const access = await canViewQuarry(quarry, session?.user?.id, viewerIsGlobalAdmin);
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
            "queries.accepted_answer_id", "queries.created_at", "queries.user_id as author_id", "queries.validation_status", "queries.is_archived", "user.name", "user.displayUsername", "user.username",
            eb.fn.coalesce("query_views.views", sql<number>`0`).as("views")
        ])
        .where("queries.id", "=", resolvedParams.id)
        .where("queries.quarry_id", "=", quarry.id)
        .where("is_hidden", "=", false)
        .executeTakeFirst();

    if (!query) return notFound();

    if (query.validation_status !== "approved" && !canModerate && session?.user?.id !== query.author_id) {
        return notFound();
    }

    const queryTagMap = await getQueryTagMap([query.id]);
    const queryTags = queryTagMap.get(query.id) || [];
    const availableTags = session?.user?.id === query.author_id
        ? await getAvailableTagsForQuarry(quarry.id, quarry.name || resolvedParams.name)
        : [];

    const answers = await db.selectFrom("answers")
        .leftJoin("user", "user.id", "answers.user_id")
        .select([
            "answers.id", "answers.body", "answers.score", "answers.parent_answer_id",
            "answers.created_at", "answers.user_id as author_id", "user.name", "user.displayUsername", "user.username"
        ])
        .where("query_id", "=", query.id)
        .where("is_hidden", "=", false)
        .where("answers.validation_status", "=", "approved")
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

        if (query!.is_archived) {
            return { ok: false, error: "This thread is archived and no longer accepts answers." };
        }

        const body = formData.get("body") as string;
        const parentId = formData.get("parent_id") as string | null;

        if (!hasRichTextContent(body)) {
            return { ok: false, error: "Answer cannot be empty." };
        }

        const postingPolicy = await getEffectivePostingPolicy({
            quarryId: quarry!.id,
            userId: session.user.id,
        });

        if (!postingPolicy.canPostAnswers) {
            return { ok: false, error: "You are not allowed to post answers in this quarry." };
        }

        const requiresReview = shouldReviewAnswer(postingPolicy);
        const normalizedBody = (await normalizeMentionContent(body, session.user.id)).content;

        try {
            const parentAnswer = parentId
                ? await db.selectFrom("answers").select(["id", "user_id"]).where("id", "=", parentId).executeTakeFirst()
                : null;

            const answer = await db.insertInto("answers").values({
                id: generateUUID(),
                query_id: query!.id,
                user_id: session.user.id,
                body: normalizedBody,
                parent_answer_id: parentId ? parentId : null,
                validation_status: requiresReview ? "pending" : "approved",
            }).returning("id").executeTakeFirst();

            if (answer && !requiresReview) {
                const href = `/q/${quarry!.name}/query/${query!.id}#answer-${answer.id}`;

                await subscribeUserToQuery(query!.id, session.user.id, "answer");
                await notifyQuerySubscribers({
                    queryId: query!.id,
                    actorUserId: session.user.id,
                    href,
                    title: `${session.user.name || "Someone"} replied in ${query!.title || "a thread"}`,
                    body: normalizedBody,
                    answerId: answer.id,
                    explicitRecipientIds: parentAnswer?.user_id ? [parentAnswer.user_id] : [],
                });
                await notifyMentions({
                    actorUserId: session.user.id,
                    content: normalizedBody,
                    href,
                    title: `${session.user.name || "Someone"} mentioned you in ${query!.title || "a thread"}`,
                    queryId: query!.id,
                    answerId: answer.id,
                });
            }

            await refreshProfileMetrics(session.user.id);
            if (requiresReview) {
                revalidatePath(`/q/${quarry!.name}/mod/queue`);
                redirect(`/q/${quarry!.name}/query/${query!.id}?queued=answer`);
            }

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

    async function editQuery(formData: FormData): Promise<SubmitQueryResult> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            redirect("/login");
        }

        if (session.user.id !== query!.author_id) {
            return { ok: false, error: "Only the thread author can edit this question." };
        }

        if (isRateLimited(session.user.id, "edit_query", MindQuarryConfig.FORUM.MAX_QUERY_EDITS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            return { ok: false, error: "You are editing too quickly. Please wait a moment." };
        }

        const title = (formData.get("title") as string || "").trim();
        const body = formData.get("body") as string;
        const selectedTagIds = formData.getAll("tag_ids").map((value) => String(value));
        const customTags = formData.get("custom_tags") as string | null;

        if (!title || !hasRichTextContent(body)) {
            return { ok: false, error: "Both the title and body are required." };
        }

        const normalizedBody = (await normalizeMentionContent(body, session.user.id)).content;

        const updated = await updateQueryByAuthor({
            queryId: query!.id,
            userId: session.user.id,
            title,
            body: normalizedBody,
        });

        if (!updated) {
            return { ok: false, error: "Unable to update this thread." };
        }

        await replaceTagsForQuery({
            queryId: query!.id,
            quarryId: quarry!.id,
            quarryName: quarry!.name || resolvedParams.name,
            selectedTagIds,
            customTagInput: customTags || "",
            userId: session.user.id,
            allowUserTags: Boolean(quarry!.allow_user_tags),
        });

        revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath("/search");
        return { ok: true };
    }

    async function deleteQueryAction() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            redirect("/login");
        }

        const result = await deleteQuery({
            queryId: query!.id,
            actorUserId: session.user.id,
            isQuarryAdmin,
        });

        if (!result.ok) {
            return;
        }

        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath("/search");
        redirect(`/q/${quarry!.name}`);
    }

    async function toggleArchiveQuery() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !isQuarryAdmin) {
            return;
        }

        const updated = await setQueryArchived({
            queryId: query!.id,
            actorUserId: session.user.id,
            archived: !query!.is_archived,
        });

        if (!updated) {
            return;
        }

        revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath("/search");
    }

    async function editAnswer(formData: FormData): Promise<SubmitAnswerResult> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            redirect("/login");
        }

        if (isRateLimited(session.user.id, "edit_answer", MindQuarryConfig.FORUM.MAX_ANSWER_EDITS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            return { ok: false, error: "You are editing too quickly. Please wait a moment." };
        }

        const answerId = formData.get("answer_id") as string;
        const body = formData.get("body") as string;

        if (!answerId || !hasRichTextContent(body)) {
            return { ok: false, error: "Answer cannot be empty." };
        }

        const normalizedBody = (await normalizeMentionContent(body, session.user.id)).content;

        const updated = await updateAnswerByAuthor({
            answerId,
            userId: session.user.id,
            body: normalizedBody,
        });

        if (!updated) {
            return { ok: false, error: "Unable to update that answer." };
        }

        revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
        revalidatePath("/search");
        return { ok: true };
    }

    async function deleteAnswer(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            redirect("/login");
        }

        if (isRateLimited(session.user.id, "delete_answer", MindQuarryConfig.FORUM.MAX_ANSWER_DELETES_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            return;
        }

        const answerId = formData.get("answer_id") as string;
        if (!answerId) {
            return;
        }

        const deletedQueryId = await deleteAnswerByAuthor({
            answerId,
            userId: session.user.id,
        });

        if (!deletedQueryId) {
            return;
        }

        revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath("/search");
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
                        <input type="checkbox" id={`collapse-${a.id}`} className="peer hidden" />
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
                                        <details className="relative">
                                            <summary className="soft-button inline-flex cursor-pointer list-none rounded-full px-3 py-1 text-xs" aria-label="Answer actions">
                                                <Ellipsis className="h-4 w-4" />
                                            </summary>
                                            <div className="absolute right-0 top-10 z-20 w-[min(22rem,80vw)] rounded-[24px] border border-border/70 bg-card p-4 shadow-lg">
                                                <div className="space-y-3 text-sm">
                                                    {session?.user && !query.is_archived && (
                                                        <details>
                                                            <summary className="cursor-pointer font-semibold text-sky-600 hover:underline">Reply / Quote</summary>
                                                            <div className="mt-4">
                                                                <SubmitAnswerForm
                                                                    parentId={a.id}
                                                                    defaultBody={buildQuotedReply(a.body)}
                                                                    submitAction={submitAnswer}
                                                                />
                                                            </div>
                                                        </details>
                                                    )}
                                                    <Link href={`/q/${quarry.name}/query/${query.id}/report?answerId=${a.id}`} className="block font-semibold text-red-500 hover:underline">
                                                        Report Answer
                                                    </Link>
                                                    {session?.user?.id === a.author_id && (
                                                        <details>
                                                            <summary className="cursor-pointer font-semibold text-sky-600 hover:underline">Edit Answer</summary>
                                                            <div className="mt-4 space-y-4">
                                                                <SubmitAnswerForm
                                                                    defaultBody={a.body || ""}
                                                                    submitAction={editAnswer}
                                                                    hiddenFields={{ answer_id: a.id }}
                                                                    submitLabel="Save Answer"
                                                                    submittingLabel="Saving..."
                                                                    resetOnSuccess={false}
                                                                />
                                                                <form action={deleteAnswer}>
                                                                    <input type="hidden" name="answer_id" value={a.id} />
                                                                    <button type="submit" className="text-xs font-bold uppercase tracking-[0.16em] text-red-500 hover:underline">
                                                                        Delete Answer
                                                                    </button>
                                                                </form>
                                                            </div>
                                                        </details>
                                                    )}
                                                    {session?.user?.id === query.author_id && (
                                                        <form action={acceptAnswer}>
                                                            <input type="hidden" name="answer_id" value={a.id} />
                                                            <button type="submit" className="cursor-pointer font-semibold text-green-600 hover:underline">
                                                                {query.accepted_answer_id === a.id ? "Unaccept" : "Accept"}
                                                            </button>
                                                        </form>
                                                    )}
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                </div>

                                <div className="peer-checked:hidden">
                                    <div className="text-sm">
                                        <TipTapRenderer content={a.body || ""} />
                                    </div>
                                </div>
                                {answers.some((child) => child.parent_answer_id === a.id) && (
                                    <div className="ml-6 mt-4">
                                        <label htmlFor={`collapse-${a.id}`} className="soft-button inline-flex cursor-pointer rounded-full px-3 py-1 text-xs" aria-label="Toggle response thread">
                                            <ChevronUp className="h-4 w-4 peer-checked:hidden" />
                                            <ChevronDown className="hidden h-4 w-4 peer-checked:block" />
                                        </label>
                                    </div>
                                )}
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
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">{query.title}</h1>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {query.is_archived && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Archived</span>}
                                {query.validation_status !== "approved" && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Pending Review</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 self-start">
                            {session?.user && (
                                <form action={toggleSubscription}>
                                    <button
                                        type="submit"
                                        aria-pressed={Boolean(subscription)}
                                        title={subscription ? "Click to unfollow this thread" : "Follow this thread"}
                                        className={subscription
                                            ? "rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 hover:border-sky-500 hover:text-sky-800 dark:text-sky-300"
                                            : "rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-sky-400/70 hover:text-sky-600"}
                                    >
                                        {subscription ? "Followed" : "Follow"}
                                    </button>
                                </form>
                            )}
                            <details className="relative">
                                <summary className="cursor-pointer list-none rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-sky-400/70 hover:text-sky-600">
                                    Actions
                                </summary>
                                <div className="absolute right-0 top-12 z-20 w-[min(26rem,80vw)] rounded-[24px] border border-border/70 bg-card p-4 shadow-lg">
                                    <div className="space-y-3 text-sm">
                                        {session?.user?.id === query.author_id && (
                                            <details>
                                                <summary className="cursor-pointer font-semibold text-sky-600 hover:underline">Edit Query</summary>
                                                <div className="mt-4 rounded-[20px] border border-border/70 bg-card p-5">
                                                    <SubmitQueryForm
                                                        submitAction={editQuery}
                                                        availableTags={availableTags}
                                                        allowCustomTags={Boolean(quarry.allow_user_tags)}
                                                        initialTitle={query.title || ""}
                                                        initialBody={query.body || ""}
                                                        selectedTagIds={queryTags.map((tag) => tag.id)}
                                                        submitLabel="Save Query"
                                                        submittingLabel="Saving..."
                                                    />
                                                </div>
                                            </details>
                                        )}
                                        {(session?.user?.id === query.author_id || isQuarryAdmin) && (
                                            <form action={deleteQueryAction}>
                                                <button type="submit" className="font-semibold text-red-500 hover:underline">Delete Query</button>
                                            </form>
                                        )}
                                        {isQuarryAdmin && (
                                            <form action={toggleArchiveQuery}>
                                                <button type="submit" className="font-semibold text-amber-600 hover:underline">{query.is_archived ? "Unarchive Query" : "Archive Query"}</button>
                                            </form>
                                        )}
                                        {canModerate && <Link href={`/q/${quarry.name}/mod/queue`} className="block font-semibold text-sky-600 hover:underline">Open Mod Queue</Link>}
                                        <Link href={`/q/${quarry.name}/query/${query.id}/report`} className="block font-semibold text-red-500 hover:underline">Report Query</Link>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>
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
                    </div>
                    {resolvedSearchParams.queued === "answer" && (
                        <div className="mb-4 rounded-[20px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
                            Your answer was submitted for moderator review.
                        </div>
                    )}
                    {query.is_archived && (
                        <div className="mb-4 rounded-[20px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
                            This thread is archived. New answers are disabled.
                        </div>
                    )}
                    <div className="text-lg">
                        <TipTapRenderer content={query.body || ""} />
                    </div>
                </div>
            </section>

            <h2 className="font-display mt-12 border-b border-border/70 pb-3 text-2xl font-semibold tracking-tight">{answers.length} Answers</h2>

            {renderAnswers()}

            {session?.user && !query.is_archived && (
                <div className="soft-panel mt-12 p-6 sm:p-8">
                    <h3 className="font-display mb-4 text-2xl font-semibold tracking-tight">Your Answer</h3>
                    <SubmitAnswerForm submitAction={submitAnswer} />
                </div>
            )}

        </div>
    );
}
