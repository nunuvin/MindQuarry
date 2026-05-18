import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUUID } from "@/lib/utils";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function QueryDiscussionPage({ params }: { params: Promise<{ name: string, id: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").select(["id", "name"]).where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const query = await db.selectFrom("queries")
        .leftJoin("user", "user.id", "queries.user_id")
        .select([
            "queries.id", "queries.title", "queries.body", "queries.score", "queries.views",
            "queries.accepted_answer_id", "queries.created_at", "queries.user_id as author_id", "user.name", "user.displayUsername", "user.username"
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
    db.updateTable("queries").set((eb) => ({ views: eb('views', '+', 1) })).where("id", "=", query.id).execute().catch(()=>null);

    async function submitAnswer(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return redirect("/login");

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

    async function voteQuery(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return redirect("/login");

        const value = parseInt(formData.get("value") as string);
        if (value !== 1 && value !== -1) return;

        try {
            const existing = await db.selectFrom("query_votes").where("query_id", "=", query!.id).where("user_id", "=", session.user.id).executeTakeFirst();
            if (existing && 'value' in existing) {
                if (existing.value === value) {
                    await db.deleteFrom("query_votes").where("query_id", "=", query!.id).where("user_id", "=", session.user.id).execute();
                    await db.updateTable("queries").set((eb) => ({ score: eb('score', '-', value) })).where("id", "=", query!.id).execute();
                } else {
                    await db.updateTable("query_votes").set({ value }).where("query_id", "=", query!.id).where("user_id", "=", session.user.id).execute();
                    await db.updateTable("queries").set((eb) => ({ score: eb('score', '+', value * 2) })).where("id", "=", query!.id).execute();
                }
            } else {
                await db.insertInto("query_votes").values({ query_id: query!.id, user_id: session.user.id, value }).execute();
                await db.updateTable("queries").set((eb) => ({ score: eb('score', '+', value) })).where("id", "=", query!.id).execute();
            }
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
                            <div className="flex-1">
                                <div className="text-xs font-bold text-muted-foreground mb-2">
                                    {a.displayUsername || a.username || a.name} • {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                                </div>
                                <p className="whitespace-pre-wrap">{a.body}</p>

                                {session?.user && (
                                    <div className="mt-4 pt-4 border-t-2 border-black/10 dark:border-white/10 flex gap-4 text-sm font-bold">
                                        <label htmlFor={`reply-${a.id}`} className="cursor-pointer hover:underline text-blue-500">Reply</label>
                                    </div>
                                )}

                                {session?.user && (
                                    <div className="mt-4 hidden has-[:checked]:block">
                                        <input type="checkbox" id={`reply-${a.id}`} className="peer hidden" />
                                        <form action={submitAnswer} className="mt-2 space-y-2">
                                            <input type="hidden" name="parent_id" value={a.id} />
                                            <textarea name="body" required rows={3} className="w-full p-2 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Write a reply..."></textarea>
                                            <button type="submit" className="px-4 py-2 bg-blue-500 text-white font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] cursor-pointer hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all text-xs">
                                                Post Reply
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                        {renderAnswers(a.id, depth + 1)}
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
                    <div className="text-sm font-bold text-muted-foreground mb-6 pb-4 border-b-2 border-black/10 dark:border-white/10">
                        Asked by {query.displayUsername || query.username || query.name} on {query.created_at ? new Date(query.created_at).toLocaleDateString() : ''} • {query.views} views
                    </div>
                    <div className="text-lg whitespace-pre-wrap">{query.body}</div>
                </div>
            </div>

            <h2 className="text-2xl font-black mt-12 mb-6 uppercase border-b-[3px] border-black dark:border-white pb-2">{answers.length} Answers</h2>

            {session?.user && (
                <div className="mb-12 p-6 bg-muted/30 border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                    <h3 className="font-black uppercase mb-4">Your Answer</h3>
                    <form action={submitAnswer} className="space-y-4">
                        <textarea name="body" required rows={5} className="w-full p-4 border-2 border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="Write your answer here..."></textarea>
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
