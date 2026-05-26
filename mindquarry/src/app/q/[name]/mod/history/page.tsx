import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { canModerateQuarry } from "@/lib/moderation";
import { generateUUID } from "@/lib/utils";
import { isGlobalAdmin } from "@/lib/admin";

export default async function QuarryModHistoryPage({ params }: { params: Promise<{ name: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");

    const resolvedParams = await params;
    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();
    const viewerIsGlobalAdmin = await isGlobalAdmin(session.user.id);

    // Verify moderator/admin
    const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry.id).where("user_id", "=", session.user.id).executeTakeFirst();
    if (!canModerateQuarry(membership?.role, viewerIsGlobalAdmin)) {
        return (
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border rounded shadow">
                <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
            </div>
        );
    }

    const [queries, answers, actions] = await Promise.all([
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
        db.selectFrom("mod_actions")
            .leftJoin("user", "user.id", "mod_actions.moderator_id")
            .select([
                "mod_actions.id",
                "mod_actions.target_type",
                "mod_actions.target_id",
                "mod_actions.action_type",
                "mod_actions.created_at",
                "user.name",
                "user.displayUsername",
                "user.username",
            ])
            .where("mod_actions.quarry_id", "=", quarry.id)
            .orderBy("mod_actions.created_at", "desc")
            .execute(),
    ]);

    async function revertHidden(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const viewerIsGlobalAdmin = await isGlobalAdmin(session.user.id);
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!canModerateQuarry(membership?.role, viewerIsGlobalAdmin)) return;

        const id = formData.get("id") as string;
        const targetType = formData.get("target_type") as string;

        if (targetType === "answer") {
            await db.updateTable("answers").set({ is_hidden: false, hidden_at: null, hidden_by_id: null }).where("id", "=", id).execute();
        } else {
            await db.updateTable("queries").set({ is_hidden: false, hidden_at: null, hidden_by_id: null }).where("id", "=", id).execute();
        }

        await db.insertInto("mod_actions").values({
            id: generateUUID(),
            quarry_id: quarry!.id,
            moderator_id: session.user.id,
            target_type: targetType,
            target_id: id,
            action_type: "unhide_content",
        }).execute();

        revalidatePath(`/q/${quarry!.name}/mod/history`);
    }

    return (
        <div className="page-shell max-w-6xl">
            <Link href={`/q/${quarry.name}/mod/queue`} className="soft-button mb-4 gap-2 rounded-full px-4 py-2">&larr; Back to Queue</Link>

            <div className="soft-panel p-6 sm:p-8">
                <div className="mb-8 border-b border-border/70 pb-6">
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Moderation</p>
                    <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">History</h1>
                </div>

                <div className="space-y-6">
                    <section className="space-y-4">
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Recent Actions</h2>
                        {actions.length === 0 && <div className="rounded-[24px] border border-dashed border-border/80 bg-muted/20 p-6 text-sm font-semibold text-muted-foreground">No moderation actions recorded yet.</div>}
                        {actions.map((action) => (
                            <div key={action.id} className="rounded-[24px] border border-border/70 bg-card/90 px-4 py-4">
                                <div className="text-sm font-semibold">{action.action_type?.replace(/_/g, " ") || "action"}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{action.displayUsername || action.username || action.name || "Unknown moderator"} • {action.target_type} • {action.created_at ? new Date(action.created_at).toLocaleString() : "Unknown time"}</div>
                            </div>
                        ))}
                    </section>

                    <section className="space-y-4">
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Hidden Content</h2>
                        {queries.map(q => (
                            <div key={q.id} className="rounded-[24px] border border-border/70 bg-card/90 p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="font-display text-xl font-semibold tracking-tight">{q.title}</span>
                                        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Posted by {q.displayUsername || q.username || q.name} • Hidden on {q.hidden_at ? new Date(q.hidden_at).toLocaleDateString() : ''}
                                        </div>
                                    </div>
                                    <form action={revertHidden}>
                                        <input type="hidden" name="id" value={q.id} />
                                        <input type="hidden" name="target_type" value="query" />
                                        <button type="submit" className="soft-button rounded-full px-4 py-2 whitespace-nowrap">
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
                            <div key={answer.id} className="rounded-[24px] border border-border/70 bg-card/90 p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="font-display text-xl font-semibold tracking-tight">Answer in {answer.query_title}</span>
                                        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Posted by {answer.displayUsername || answer.username || answer.name} • Hidden on {answer.hidden_at ? new Date(answer.hidden_at).toLocaleDateString() : ''}
                                        </div>
                                    </div>
                                    <form action={revertHidden}>
                                        <input type="hidden" name="id" value={answer.id} />
                                        <input type="hidden" name="target_type" value="answer" />
                                        <button type="submit" className="soft-button rounded-full px-4 py-2 whitespace-nowrap">
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
                            <div className="rounded-[28px] border border-dashed border-border/80 bg-muted/20 p-12 text-center text-sm font-semibold text-muted-foreground">
                                No hidden queries.
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
