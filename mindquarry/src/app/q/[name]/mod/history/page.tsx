import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { canModerateQuarry } from "@/lib/moderation";

export default async function QuarryModHistoryPage({ params }: { params: Promise<{ name: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");

    const resolvedParams = await params;
    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    // Verify moderator/admin
    const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry.id).where("user_id", "=", session.user.id).executeTakeFirst();
    if (!membership || !canModerateQuarry(membership.role)) {
        return (
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border rounded shadow">
                <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
            </div>
        );
    }

    const [queries, answers] = await Promise.all([
        db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .select([
                "queries.id", "queries.title", "queries.body", "queries.hidden_at", "queries.created_at",
                "user.name", "user.displayUsername", "user.username"
            ])
            .where("quarry_id", "=", quarry.id)
            .where("is_hidden", "=", true)
            .orderBy("hidden_at", "desc")
            .execute(),
        db.selectFrom("answers")
            .innerJoin("queries", "queries.id", "answers.query_id")
            .leftJoin("user", "user.id", "answers.user_id")
            .select([
                "answers.id",
                "answers.body",
                "answers.hidden_at",
                "queries.title as query_title",
                "user.name",
                "user.displayUsername",
                "user.username"
            ])
            .where("queries.quarry_id", "=", quarry.id)
            .where("answers.is_hidden", "=", true)
            .orderBy("answers.hidden_at", "desc")
            .execute(),
    ]);

    async function revertHidden(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || !canModerateQuarry(membership.role)) return;

        const id = formData.get("id") as string;
        const targetType = formData.get("target_type") as string;

        if (targetType === "answer") {
            await db.updateTable("answers").set({ is_hidden: false, hidden_at: null, hidden_by_id: null }).where("id", "=", id).execute();
        } else {
            await db.updateTable("queries").set({ is_hidden: false, hidden_at: null, hidden_by_id: null }).where("id", "=", id).execute();
        }

        revalidatePath(`/q/${quarry!.name}/mod/history`);
    }

    return (
        <div className="max-w-6xl mx-auto mt-8 p-4">
            <Link href={`/q/${quarry.name}/mod/queue`} className="text-sm font-bold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to Queue</Link>

            <div className="p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
                <h1 className="text-3xl font-black uppercase tracking-tight mb-8 border-b-[3px] border-black dark:border-white pb-2">Mod History (Soft Deletes)</h1>

                <div className="space-y-6">
                    {queries.map(q => (
                        <div key={q.id} className="p-4 border-2 border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="font-bold text-lg">{q.title}</span>
                                    <div className="text-xs font-bold text-muted-foreground mt-1">
                                        Posted by {q.displayUsername || q.username || q.name} • Hidden on {q.hidden_at ? new Date(q.hidden_at).toLocaleDateString() : ''}
                                    </div>
                                </div>
                                <form action={revertHidden}>
                                    <input type="hidden" name="id" value={q.id} />
                                    <input type="hidden" name="target_type" value="query" />
                                    <button type="submit" className="px-4 py-2 font-bold border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] whitespace-nowrap">
                                        Revert (Unhide)
                                    </button>
                                </form>
                            </div>
                            <div className="text-sm text-muted-foreground line-clamp-3">
                                {q.body}
                            </div>
                        </div>
                    ))}

                    {answers.map(answer => (
                        <div key={answer.id} className="p-4 border-2 border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="font-bold text-lg">Answer in {answer.query_title}</span>
                                    <div className="text-xs font-bold text-muted-foreground mt-1">
                                        Posted by {answer.displayUsername || answer.username || answer.name} • Hidden on {answer.hidden_at ? new Date(answer.hidden_at).toLocaleDateString() : ''}
                                    </div>
                                </div>
                                <form action={revertHidden}>
                                    <input type="hidden" name="id" value={answer.id} />
                                    <input type="hidden" name="target_type" value="answer" />
                                    <button type="submit" className="px-4 py-2 font-bold border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] whitespace-nowrap">
                                        Revert (Unhide)
                                    </button>
                                </form>
                            </div>
                            <div className="text-sm text-muted-foreground line-clamp-3">
                                {answer.body}
                            </div>
                        </div>
                    ))}

                    {queries.length === 0 && answers.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                            No hidden queries.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
