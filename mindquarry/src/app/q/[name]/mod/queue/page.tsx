import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { canModerateQuarry, upsertPostingPolicy } from "@/lib/moderation";

export default async function QuarryModQueuePage({ params }: { params: Promise<{ name: string }> }) {
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

    const reports = await db.selectFrom("user_reports")
        .leftJoin("user as reporter", "reporter.id", "user_reports.reporter_id")
        .leftJoin("user as reported", "reported.id", "user_reports.reported_id")
        .select([
            "user_reports.id", "user_reports.reason", "user_reports.status", "user_reports.created_at",
            "user_reports.target_id", "user_reports.target_type",
            "reporter.name as reporter_name", "reporter.displayUsername as reporter_username",
            "reported.name as reported_name", "reported.displayUsername as reported_username",
            "reported.id as reported_id", "reporter.id as reporter_id"
        ])
        .where("quarry_id", "=", quarry.id)
        .where("status", "=", "pending")
        .orderBy("created_at", "desc")
        .execute();

    // Group repeat reports
    const reportGroups = new Map<string, typeof reports>();
    reports.forEach(r => {
        const key = `${r.target_type}-${r.target_id}`;
        if (!reportGroups.has(key)) {
            reportGroups.set(key, []);
        }
        reportGroups.get(key)!.push(r);
    });

    const uniqueReports = Array.from(reportGroups.values());

    const [pendingQueries, pendingAnswers] = await Promise.all([
        db.selectFrom("queries")
            .leftJoin("user", "user.id", "queries.user_id")
            .select([
                "queries.id",
                "queries.title",
                "queries.body",
                "queries.created_at",
                "queries.user_id as author_id",
                "user.name",
                "user.displayUsername",
                "user.username",
            ])
            .where("queries.quarry_id", "=", quarry.id)
            .where("queries.validation_status", "=", "pending")
            .where("queries.is_hidden", "=", false)
            .orderBy("queries.created_at", "desc")
            .execute(),
        db.selectFrom("answers")
            .innerJoin("queries", "queries.id", "answers.query_id")
            .leftJoin("user", "user.id", "answers.user_id")
            .select([
                "answers.id",
                "answers.body",
                "answers.created_at",
                "answers.user_id as author_id",
                "queries.id as query_id",
                "queries.title as query_title",
                "user.name",
                "user.displayUsername",
                "user.username",
            ])
            .where("queries.quarry_id", "=", quarry.id)
            .where("answers.validation_status", "=", "pending")
            .where("answers.is_hidden", "=", false)
            .orderBy("answers.created_at", "desc")
            .execute(),
    ]);

    async function dismissReport(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || !canModerateQuarry(membership.role)) return;

        const id = formData.get("id") as string;
        await db.updateTable("user_reports").set({ status: "dismissed" }).where("id", "=", id).execute();
        revalidatePath(`/q/${quarry!.name}/mod/queue`);
    }

    async function hideItem(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || !canModerateQuarry(membership.role)) return;

        const targetId = formData.get("target_id") as string;
        const targetType = formData.get("target_type") as string;

        if (targetType === "query") {
            await db.updateTable("queries").set({ is_hidden: true, hidden_at: new Date(), hidden_by_id: session.user.id }).where("id", "=", targetId).execute();
        } else if (targetType === "answer") {
            await db.updateTable("answers").set({ is_hidden: true, hidden_at: new Date(), hidden_by_id: session.user.id }).where("id", "=", targetId).execute();
        }

        await db.updateTable("user_reports").set({ status: "actioned" }).where("target_id", "=", targetId).where("target_type", "=", targetType).execute();
        revalidatePath(`/q/${quarry!.name}/mod/queue`);
    }

    async function escalateReport(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || !canModerateQuarry(membership.role)) return;

        const targetId = formData.get("target_id") as string;
        const targetType = formData.get("target_type") as string;

        await db.updateTable("user_reports").set({ status: "escalated", quarry_id: null }).where("target_id", "=", targetId).where("target_type", "=", targetType).execute();
        revalidatePath(`/q/${quarry!.name}/mod/queue`);
    }

    async function approvePending(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || !canModerateQuarry(membership.role)) return;

        const targetId = formData.get("target_id") as string;
        const targetType = formData.get("target_type") as string;

        if (targetType === "query") {
            await db.updateTable("queries")
                .set({ validation_status: "approved", validated_at: new Date(), validated_by_id: session.user.id })
                .where("id", "=", targetId)
                .execute();
        } else if (targetType === "answer") {
            await db.updateTable("answers")
                .set({ validation_status: "approved", validated_at: new Date(), validated_by_id: session.user.id })
                .where("id", "=", targetId)
                .execute();
        }

        revalidatePath(`/q/${quarry!.name}/mod/queue`);
        revalidatePath(`/q/${quarry!.name}`);
    }

    async function applyUserRestriction(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || !canModerateQuarry(membership.role)) return;

        const targetUserId = formData.get("user_id") as string;
        const preset = formData.get("preset") as string;
        if (!targetUserId || !preset) return;

        let reviewMode = "none";
        let canPostQueries = true;
        let canPostAnswers = true;

        if (preset === "review_all") {
            reviewMode = "query_and_answer";
        }

        if (preset === "silence_answers") {
            canPostAnswers = false;
        }

        if (preset === "silence_all") {
            canPostQueries = false;
            canPostAnswers = false;
        }

        await upsertPostingPolicy({
            actorUserId: session.user.id,
            quarryId: quarry!.id,
            userId: targetUserId,
            reviewMode,
            canPostQueries,
            canPostAnswers,
        });

        revalidatePath(`/q/${quarry!.name}/mod/queue`);
        revalidatePath(`/q/${quarry!.name}/settings`);
    }

    return (
        <div className="max-w-6xl mx-auto mt-8 p-4">
            <Link href={`/q/${quarry.name}`} className="text-sm font-bold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to q/{quarry.name}</Link>

            <div className="p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
                <div className="flex justify-between items-center mb-8 border-b-[3px] border-black dark:border-white pb-2">
                    <h1 className="text-3xl font-black uppercase tracking-tight">Mod Queue</h1>
                    <Link href={`/q/${quarry.name}/mod/history`} className="text-blue-500 font-bold hover:underline">View History</Link>
                </div>

                <div className="space-y-8">
                    {(pendingQueries.length > 0 || pendingAnswers.length > 0) && (
                        <section className="space-y-6">
                            <h2 className="font-black uppercase text-muted-foreground">Pending Review</h2>

                            {pendingQueries.map((pendingQuery) => (
                                <div key={pendingQuery.id} className="grid grid-cols-1 gap-6 border-[3px] border-amber-500/40 bg-amber-500/5 p-4">
                                    <div>
                                        <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Query awaiting approval</div>
                                        <h3 className="text-lg font-bold">{pendingQuery.title}</h3>
                                        <p className="mt-2 text-sm text-muted-foreground">By {pendingQuery.displayUsername || pendingQuery.username || pendingQuery.name}</p>
                                        <div className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{pendingQuery.body}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-sm font-semibold">
                                        <form action={approvePending}>
                                            <input type="hidden" name="target_id" value={pendingQuery.id} />
                                            <input type="hidden" name="target_type" value="query" />
                                            <button type="submit" className="px-4 py-2 border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white">Approve</button>
                                        </form>
                                        <form action={hideItem}>
                                            <input type="hidden" name="target_id" value={pendingQuery.id} />
                                            <input type="hidden" name="target_type" value="query" />
                                            <button type="submit" className="px-4 py-2 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white">Hide</button>
                                        </form>
                                        <form action={applyUserRestriction}>
                                            <input type="hidden" name="user_id" value={pendingQuery.author_id || ""} />
                                            <input type="hidden" name="preset" value="review_all" />
                                            <button type="submit" className="px-4 py-2 border-2 border-amber-600 text-amber-700 hover:bg-amber-600 hover:text-white">Require Review</button>
                                        </form>
                                        <form action={applyUserRestriction}>
                                            <input type="hidden" name="user_id" value={pendingQuery.author_id || ""} />
                                            <input type="hidden" name="preset" value="silence_all" />
                                            <button type="submit" className="px-4 py-2 border-2 border-black dark:border-white">Silence User</button>
                                        </form>
                                    </div>
                                </div>
                            ))}

                            {pendingAnswers.map((pendingAnswer) => (
                                <div key={pendingAnswer.id} className="grid grid-cols-1 gap-6 border-[3px] border-amber-500/40 bg-amber-500/5 p-4">
                                    <div>
                                        <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Answer awaiting approval</div>
                                        <div className="text-sm font-semibold text-muted-foreground">Thread: {pendingAnswer.query_title}</div>
                                        <p className="mt-2 text-sm text-muted-foreground">By {pendingAnswer.displayUsername || pendingAnswer.username || pendingAnswer.name}</p>
                                        <div className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{pendingAnswer.body}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-sm font-semibold">
                                        <form action={approvePending}>
                                            <input type="hidden" name="target_id" value={pendingAnswer.id} />
                                            <input type="hidden" name="target_type" value="answer" />
                                            <button type="submit" className="px-4 py-2 border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white">Approve</button>
                                        </form>
                                        <form action={hideItem}>
                                            <input type="hidden" name="target_id" value={pendingAnswer.id} />
                                            <input type="hidden" name="target_type" value="answer" />
                                            <button type="submit" className="px-4 py-2 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white">Hide</button>
                                        </form>
                                        <form action={applyUserRestriction}>
                                            <input type="hidden" name="user_id" value={pendingAnswer.author_id || ""} />
                                            <input type="hidden" name="preset" value="review_all" />
                                            <button type="submit" className="px-4 py-2 border-2 border-amber-600 text-amber-700 hover:bg-amber-600 hover:text-white">Require Review</button>
                                        </form>
                                        <form action={applyUserRestriction}>
                                            <input type="hidden" name="user_id" value={pendingAnswer.author_id || ""} />
                                            <input type="hidden" name="preset" value="silence_answers" />
                                            <button type="submit" className="px-4 py-2 border-2 border-black dark:border-white">Silence Answers</button>
                                        </form>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {uniqueReports.map(group => {
                        const r = group[0];
                        const repeatCount = group.length;

                        return (
                            <div key={r.id} className="grid grid-cols-1 md:grid-cols-3 gap-6 border-[3px] border-black dark:border-white p-4 shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] relative">
                                {repeatCount > 1 && (
                                    <div className="absolute -top-3 -right-3 bg-red-500 text-white font-black px-3 py-1 border-[3px] border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]">
                                        {repeatCount} REPORTS
                                    </div>
                                )}
                                <div className="md:col-span-2">
                                    <h3 className="font-black uppercase text-lg mb-2">Reported Content ({r.target_type})</h3>
                                    <div className="p-4 bg-muted/30 border-l-4 border-red-500 whitespace-pre-wrap font-medium text-sm mb-4 flex flex-col gap-4">
                                        {group.map(report => (
                                            <div key={report.id} className="border-b-2 border-black/10 dark:border-white/10 pb-4 last:border-0 last:pb-0">
                                                <span className="font-bold text-xs uppercase text-muted-foreground block mb-1">Reason from {report.reporter_username || report.reporter_name}</span>
                                                {report.reason}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-4 flex-wrap">
                                        <form action={dismissReport}>
                                            <input type="hidden" name="id" value={r.id} />
                                            <button type="submit" className="px-4 py-2 font-bold border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]">
                                                Dismiss All
                                            </button>
                                        </form>
                                        <form action={hideItem}>
                                            <input type="hidden" name="id" value={r.id} />
                                            <input type="hidden" name="target_id" value={r.target_id || ''} />
                                            <input type="hidden" name="target_type" value={r.target_type || ''} />
                                            <button type="submit" className="px-4 py-2 font-bold border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white cursor-pointer shadow-[2px_2px_0_0_#ef4444]">
                                                Hide Content
                                            </button>
                                        </form>
                                        <form action={escalateReport}>
                                            <input type="hidden" name="target_id" value={r.target_id || ''} />
                                            <input type="hidden" name="target_type" value={r.target_type || ''} />
                                            <button type="submit" className="px-4 py-2 font-bold border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white cursor-pointer shadow-[2px_2px_0_0_#f97316]">
                                                Escalate to Global
                                            </button>
                                        </form>
                                        <form action={applyUserRestriction}>
                                            <input type="hidden" name="user_id" value={r.reported_id || ''} />
                                            <input type="hidden" name="preset" value="review_all" />
                                            <button type="submit" className="px-4 py-2 font-bold border-2 border-amber-600 text-amber-700 hover:bg-amber-600 hover:text-white">
                                                Require Review
                                            </button>
                                        </form>
                                        <form action={applyUserRestriction}>
                                            <input type="hidden" name="user_id" value={r.reported_id || ''} />
                                            <input type="hidden" name="preset" value="silence_all" />
                                            <button type="submit" className="px-4 py-2 font-bold border-2 border-black dark:border-white">
                                                Silence User
                                            </button>
                                        </form>
                                    </div>
                                </div>

                                <div className="border-l-2 border-black/20 dark:border-white/20 pl-6 flex flex-col justify-start">
                                    <div className="mb-4">
                                        <h4 className="font-bold text-xs uppercase text-muted-foreground mb-1">Reported User</h4>
                                        <div className="font-bold text-lg">{r.reported_username || r.reported_name}</div>
                                        {r.reported_username ? (
                                            <a href={`/users/${r.reported_username}`} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">View Profile &rarr;</a>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Profile link unavailable</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {uniqueReports.length === 0 && pendingQueries.length === 0 && pendingAnswers.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                            The moderation queue is empty.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
