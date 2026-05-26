import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { canModerateQuarry, upsertPostingPolicy } from "@/lib/moderation";
import { generateUUID, richTextToPlainText } from "@/lib/utils";

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
        await db.insertInto("mod_actions").values({
            id: generateUUID(),
            quarry_id: quarry!.id,
            moderator_id: session.user.id,
            target_type: "report",
            target_id: id,
            action_type: "dismiss_report",
        }).execute();
        revalidatePath(`/q/${quarry!.name}/mod/queue`);
        revalidatePath(`/q/${quarry!.name}/mod/history`);
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

        await db.insertInto("mod_actions").values({
            id: generateUUID(),
            quarry_id: quarry!.id,
            moderator_id: session.user.id,
            target_type: targetType,
            target_id: targetId,
            action_type: "hide_content",
        }).execute();

        await db.updateTable("user_reports").set({ status: "actioned" }).where("target_id", "=", targetId).where("target_type", "=", targetType).execute();
        revalidatePath(`/q/${quarry!.name}/mod/queue`);
        revalidatePath(`/q/${quarry!.name}/mod/history`);
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
        await db.insertInto("mod_actions").values({
            id: generateUUID(),
            quarry_id: quarry!.id,
            moderator_id: session.user.id,
            target_type: targetType,
            target_id: targetId,
            action_type: "escalate_report",
        }).execute();
        revalidatePath(`/q/${quarry!.name}/mod/queue`);
        revalidatePath(`/q/${quarry!.name}/mod/history`);
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

        await db.insertInto("mod_actions").values({
            id: generateUUID(),
            quarry_id: quarry!.id,
            moderator_id: session.user.id,
            target_type: targetType,
            target_id: targetId,
            action_type: "approve_pending",
        }).execute();

        revalidatePath(`/q/${quarry!.name}/mod/queue`);
        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath(`/q/${quarry!.name}/mod/history`);
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

        await db.insertInto("mod_actions").values({
            id: generateUUID(),
            quarry_id: quarry!.id,
            moderator_id: session.user.id,
            target_type: "user",
            target_id: targetUserId,
            action_type: preset,
        }).execute();

        revalidatePath(`/q/${quarry!.name}/mod/queue`);
        revalidatePath(`/q/${quarry!.name}/settings`);
        revalidatePath(`/q/${quarry!.name}/mod/history`);
    }

    return (
        <div className="page-shell max-w-6xl">
            <Link href={`/q/${quarry.name}`} className="soft-button mb-4 gap-2 rounded-full px-4 py-2">&larr; Back to q/{quarry.name}</Link>

            <div className="soft-panel p-6 sm:p-8">
                <div className="mb-8 flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Moderation</p>
                        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Mod Queue</h1>
                    </div>
                    <Link href={`/q/${quarry.name}/mod/history`} className="soft-button rounded-full px-4 py-2">View History</Link>
                </div>

                <div className="space-y-8">
                    {(pendingQueries.length > 0 || pendingAnswers.length > 0) && (
                        <section className="space-y-6">
                            <h2 className="font-display text-2xl font-semibold tracking-tight">Pending Review</h2>

                            {pendingQueries.map((pendingQuery) => (
                                <div key={pendingQuery.id} className="grid gap-6 rounded-[28px] border border-amber-500/30 bg-amber-500/5 p-5 lg:grid-cols-[1.3fr_0.7fr]">
                                    <div className="min-w-0">
                                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Query awaiting approval</div>
                                        <h3 className="font-display text-2xl font-semibold tracking-tight">{pendingQuery.title}</h3>
                                        <p className="mt-2 text-sm text-muted-foreground">By {pendingQuery.displayUsername || pendingQuery.username || pendingQuery.name}</p>
                                        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{richTextToPlainText(pendingQuery.body || "")}</div>
                                    </div>
                                    <div className="rounded-[24px] border border-border/70 bg-card/80 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Decision</p>
                                        <div className="mt-4 space-y-3">
                                            <form action={approvePending}>
                                                <input type="hidden" name="target_id" value={pendingQuery.id} />
                                                <input type="hidden" name="target_type" value="query" />
                                                <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">Approve</button>
                                            </form>
                                            <form action={hideItem}>
                                                <input type="hidden" name="target_id" value={pendingQuery.id} />
                                                <input type="hidden" name="target_type" value="query" />
                                                <button type="submit" className="w-full rounded-full border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-500 hover:text-white">Hide</button>
                                            </form>
                                            <form action={applyUserRestriction} className="space-y-3">
                                                <input type="hidden" name="user_id" value={pendingQuery.author_id || ""} />
                                                <select name="preset" defaultValue="review_all" className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-sky-500">
                                                    <option value="review_all">Require review</option>
                                                    <option value="silence_answers">Silence answers</option>
                                                    <option value="silence_all">Silence user</option>
                                                </select>
                                                <button type="submit" className="soft-button w-full justify-center rounded-full py-3">Apply restriction</button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {pendingAnswers.map((pendingAnswer) => (
                                <div key={pendingAnswer.id} className="grid gap-6 rounded-[28px] border border-amber-500/30 bg-amber-500/5 p-5 lg:grid-cols-[1.3fr_0.7fr]">
                                    <div className="min-w-0">
                                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Answer awaiting approval</div>
                                        <div className="text-sm font-semibold text-muted-foreground">Query: {pendingAnswer.query_title}</div>
                                        <p className="mt-2 text-sm text-muted-foreground">By {pendingAnswer.displayUsername || pendingAnswer.username || pendingAnswer.name}</p>
                                        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{richTextToPlainText(pendingAnswer.body || "")}</div>
                                    </div>
                                    <div className="rounded-[24px] border border-border/70 bg-card/80 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Decision</p>
                                        <div className="mt-4 space-y-3">
                                            <form action={approvePending}>
                                                <input type="hidden" name="target_id" value={pendingAnswer.id} />
                                                <input type="hidden" name="target_type" value="answer" />
                                                <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">Approve</button>
                                            </form>
                                            <form action={hideItem}>
                                                <input type="hidden" name="target_id" value={pendingAnswer.id} />
                                                <input type="hidden" name="target_type" value="answer" />
                                                <button type="submit" className="w-full rounded-full border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-500 hover:text-white">Hide</button>
                                            </form>
                                            <form action={applyUserRestriction} className="space-y-3">
                                                <input type="hidden" name="user_id" value={pendingAnswer.author_id || ""} />
                                                <select name="preset" defaultValue="review_all" className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-sky-500">
                                                    <option value="review_all">Require review</option>
                                                    <option value="silence_answers">Silence answers</option>
                                                    <option value="silence_all">Silence user</option>
                                                </select>
                                                <button type="submit" className="soft-button w-full justify-center rounded-full py-3">Apply restriction</button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {uniqueReports.map(group => {
                        const r = group[0];
                        const repeatCount = group.length;

                        return (
                            <div key={r.id} className="relative grid gap-6 rounded-[28px] border border-border/70 bg-card/90 p-5 lg:grid-cols-[1.25fr_0.75fr]">
                                {repeatCount > 1 && (
                                    <div className="absolute -right-2 -top-2 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                                        {repeatCount} REPORTS
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-display mb-2 text-2xl font-semibold tracking-tight">Reported {r.target_type}</h3>
                                    <div className="mb-4 flex flex-col gap-4 rounded-[24px] border border-red-500/20 bg-red-500/5 p-4 text-sm">
                                        {group.map(report => (
                                            <div key={report.id} className="border-b-2 border-black/10 dark:border-white/10 pb-4 last:border-0 last:pb-0">
                                                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Reason from {report.reporter_username || report.reporter_name}</span>
                                                {report.reason}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                                    <div className="mb-4">
                                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Reported User</h4>
                                        <div className="text-lg font-semibold">{r.reported_username || r.reported_name}</div>
                                        {r.reported_username ? (
                                            <a href={`/users/${r.reported_username}`} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">View Profile &rarr;</a>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Profile link unavailable</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Decision</p>
                                    <div className="mt-4 space-y-3">
                                        <form action={dismissReport}>
                                            <input type="hidden" name="id" value={r.id} />
                                            <button type="submit" className="soft-button w-full justify-center rounded-full py-3">Dismiss</button>
                                        </form>
                                        <form action={hideItem}>
                                            <input type="hidden" name="id" value={r.id} />
                                            <input type="hidden" name="target_id" value={r.target_id || ''} />
                                            <input type="hidden" name="target_type" value={r.target_type || ''} />
                                            <button type="submit" className="w-full rounded-full border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-500 hover:text-white">Hide content</button>
                                        </form>
                                        <form action={escalateReport}>
                                            <input type="hidden" name="target_id" value={r.target_id || ''} />
                                            <input type="hidden" name="target_type" value={r.target_type || ''} />
                                            <button type="submit" className="w-full rounded-full border border-amber-500/40 px-4 py-3 text-sm font-semibold text-amber-600 hover:bg-amber-500 hover:text-white">Escalate</button>
                                        </form>
                                        <form action={applyUserRestriction} className="space-y-3">
                                            <input type="hidden" name="user_id" value={r.reported_id || ''} />
                                            <select name="preset" defaultValue="review_all" className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-sky-500">
                                                <option value="review_all">Require review</option>
                                                <option value="silence_answers">Silence answers</option>
                                                <option value="silence_all">Silence user</option>
                                            </select>
                                            <button type="submit" className="soft-button w-full justify-center rounded-full py-3">Apply restriction</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {uniqueReports.length === 0 && pendingQueries.length === 0 && pendingAnswers.length === 0 && (
                        <div className="rounded-[28px] border border-dashed border-border/80 bg-muted/20 p-12 text-center text-sm font-semibold text-muted-foreground">
                            The moderation queue is empty.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
