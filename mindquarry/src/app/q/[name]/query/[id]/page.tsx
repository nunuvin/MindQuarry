import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUUID } from "@/lib/utils";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { CopyLinkButton } from "./CopyLinkButton";
import { TipTapEditor } from "@/components/TipTapEditor";
import { TipTapRenderer } from "@/components/TipTapRenderer";
import { isRateLimited } from "@/lib/rateLimit";
import { sql } from "kysely";

export default async function QueryDiscussionPage({ params }: { params: Promise<{ name: string, id: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").select(["id", "name", "is_invite_only"]).where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    if (quarry.is_invite_only) {
        if (!session?.user) redirect("/login");
        const membership = await db.selectFrom("quarry_members").where("quarry_id", "=", quarry.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership) {
            return (
                <div className="max-w-4xl mx-auto mt-12 p-12 text-center border-2 border-black dark:border-white">
                    <h1 className="text-2xl font-black uppercase mb-4 text-red-500">Private Community</h1>
                    <p>This Quarry is invite-only. You must be added by an admin to view its contents or participate.</p>
                </div>
            );
        }
    }

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

    // Fire and forget view increment
    db.insertInto("query_views")
        .values({ query_id: query.id, views: 1 })
        .onConflict((oc) => oc.column("query_id").doUpdateSet({ views: sql<number>`query_views.views + 1` }))
        .execute().catch(() => null);

    async function submitAnswer(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return redirect("/login");

        // Rate limit: Max 10 replies per minute
        if (isRateLimited(session.user.id, "submit_answer", 10, 60000)) {
            console.warn(`User ${session.user.id} rate limited on answer submission.`);
            return;
        }

        const body = formData.get("body") as string;
        const parentId = formData.get("parent_id") as string | null;

        if (!body) return;

        try {
            await db.insertInto("answers").values({
                id: generateUUID(),
                query_id: query!.id,
                user_id: session.user.id,
                body,
                parent_answer_id: parentId ? parentId : null,
            }).execute();
            revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
        } catch (e) {
            console.error("Failed to submit answer", e);
        }
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
            await db.transaction().execute(async (trx) => {
                const existing = await trx.selectFrom("query_votes").where("query_id", "=", query!.id).where("user_id", "=", session.user.id).executeTakeFirst();
                if (existing && 'value' in existing) {
                    if (existing.value === value) {
                        await trx.deleteFrom("query_votes").where("query_id", "=", query!.id).where("user_id", "=", session.user.id).execute();
                        await trx.updateTable("queries").set((eb) => ({ score: eb('score', '-', value) })).where("id", "=", query!.id).execute();
                    } else {
                        await trx.updateTable("query_votes").set({ value }).where("query_id", "=", query!.id).where("user_id", "=", session.user.id).execute();
                        await trx.updateTable("queries").set((eb) => ({ score: eb('score', '+', value * 2) })).where("id", "=", query!.id).execute();
                    }
                } else {
                    await trx.insertInto("query_votes").values({ query_id: query!.id, user_id: session.user.id, value }).execute();
                    await trx.updateTable("queries").set((eb) => ({ score: eb('score', '+', value) })).where("id", "=", query!.id).execute();
                }
            });
            revalidatePath(`/q/${quarry!.name}/query/${query!.id}`);
        } catch(e) {}
    }

    const renderAnswers = (parentId: string | null = null, depth = 0) => {
        const filtered = answers.filter(a => a.parent_answer_id === parentId);
        if (filtered.length === 0) return null;

        return (
            <div className={`space-y-4 ${depth > 0 ? "ml-8 pl-4 border-l-2 border-muted-foreground/30" : "mt-8"}`}>
                {filtered.map(a => (
                    <div key={a.id} className="p-4 bg-card border-2 border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center justify-start min-w-[40px] gap-2">
                                <span className="font-black text-lg">{a.score}</span>
                                {query.accepted_answer_id === a.id && (
                                    <div className="text-green-500 font-bold border-2 border-green-500 px-1 py-0.5 text-xs">✓</div>
                                )}
                            </div>
                            <div className="flex-1" id={`reply-${a.id}`}>
                                <div className="text-xs font-bold text-muted-foreground mb-2 flex justify-between items-center">
                                    <span>{a.displayUsername || a.username || a.name} • {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</span>
                                    <div className="flex gap-2">
                                        <CopyLinkButton answerId={a.id} />
                                        <label htmlFor={`collapse-${a.id}`} className="cursor-pointer px-2 border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black">
                                            +/-
                                        </label>
                                    </div>
                                </div>

                                <input type="checkbox" id={`collapse-${a.id}`} className="peer hidden" />

                                <div className="peer-checked:hidden">
                                    <div className="text-sm">
                                        <TipTapRenderer content={a.body || ""} />
                                    </div>

                                    <div className="mt-4 pt-4 border-t-2 border-black/10 dark:border-white/10 flex gap-4 text-sm font-bold items-center">
                                        {session?.user && (
                                            <label htmlFor={`reply-${a.id}`} className="cursor-pointer hover:underline text-blue-500">Reply</label>
                                        )}
                                        {session?.user?.id === query.author_id && (
                                            <form action={acceptAnswer}>
                                                <input type="hidden" name="answer_id" value={a.id} />
                                                <button type="submit" className="text-green-600 hover:underline cursor-pointer">
                                                    {query.accepted_answer_id === a.id ? "Unaccept" : "Accept"}
                                                </button>
                                            </form>
                                        )}
                                    </div>


                                    {session?.user && (
                                        <div className="mt-4 hidden has-[:checked]:block">
                                            <input type="checkbox" id={`reply-${a.id}`} className="peer hidden" />
                                            <form action={submitAnswer} className="mt-2 space-y-2">
                                                <input type="hidden" name="parent_id" value={a.id} />
                                                <TipTapEditor name="body" />
                                                <button type="submit" className="px-4 py-2 bg-blue-500 text-white font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] cursor-pointer hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all text-xs">
                                                    Post Reply
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="peer-checked:hidden">
                            {renderAnswers(a.id, depth + 1)}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto mt-8 p-4">
            <Link href={`/q/${quarry.name}`} className="text-sm font-bold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to q/{quarry.name}</Link>

            <div className="p-6 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff] flex gap-6 relative">
                {query.score !== null && query.score <= -5 && (
                    <div className="absolute inset-0 bg-muted/95 backdrop-blur-md z-10 flex flex-col items-center justify-center font-bold text-red-600 border-[3px] border-black dark:border-white opacity-100 group">
                        <span className="mb-4 text-xl uppercase">Hidden due to low score (-5 or below)</span>
                        <label htmlFor="reveal-query" className="cursor-pointer px-6 py-2 bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition-colors">
                            Reveal Anyway
                        </label>
                    </div>
                )}
                <input type="checkbox" id="reveal-query" className="peer hidden" />

                <div className="flex flex-col items-center gap-2 peer-checked:[&~div]:!opacity-100">
                    <form action={voteQuery}>
                        <input type="hidden" name="value" value="1" />
                        <button type="submit" className="w-10 h-10 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-black text-xl flex items-center justify-center cursor-pointer transition-colors shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]">
                            ▲
                        </button>
                    </form>
                    <span className="text-2xl font-black">{query.score}</span>
                    <form action={voteQuery}>
                        <input type="hidden" name="value" value="-1" />
                        <button type="submit" className="w-10 h-10 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-black text-xl flex items-center justify-center cursor-pointer transition-colors shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] text-red-500 hover:text-red-500">
                            ▼
                        </button>
                    </form>
                </div>
                <div className="flex-1 peer-checked:opacity-100">
                    <h1 className="text-3xl font-black mb-4">{query.title}</h1>
                    <div className="text-sm font-bold text-muted-foreground mb-6 pb-4 border-b-2 border-black/10 dark:border-white/10 flex justify-between">
                        <span>Asked by {query.displayUsername || query.username || query.name} on {query.created_at ? new Date(query.created_at).toLocaleDateString() : ''} • {query.views} views</span>
                        <Link href={`/q/${quarry.name}/query/${query.id}/report`} className="text-red-500 hover:underline">Report</Link>
                    </div>
                    <div className="text-lg">
                        <TipTapRenderer content={query.body || ""} />
                    </div>
                </div>
            </div>

            <h2 className="text-2xl font-black mt-12 mb-6 uppercase border-b-[3px] border-black dark:border-white pb-2">{answers.length} Answers</h2>

            {session?.user && (
                <div className="mb-12 p-6 bg-muted/30 border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                    <h3 className="font-black uppercase mb-4">Your Answer</h3>
                    <form action={submitAnswer} className="space-y-4">
                        <TipTapEditor name="body" />
                        <button type="submit" className="px-8 py-3 bg-blue-500 text-white font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:bg-blue-600 transition-colors">
                            Post Answer
                        </button>
                    </form>
                </div>
            )}

            {renderAnswers()}

        </div>
    );
}
