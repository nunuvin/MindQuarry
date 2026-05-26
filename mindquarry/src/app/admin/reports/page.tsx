import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isGlobalAdmin } from "@/lib/admin";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";
import { SecurityRateLimits } from "@/lib/security";

export default async function AdminReportsPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const isAdmin = await isGlobalAdmin(session.user.id);

    if (!isAdmin) {
        return (
            <div className="page-shell max-w-4xl">
                <section className="soft-panel mt-12 p-6 sm:p-8">
                    <h1 className="font-display text-2xl font-semibold tracking-tight text-red-500">Access Denied</h1>
                    <p className="mt-3 text-sm text-muted-foreground">You must be a global administrator to review escalated reports.</p>
                </section>
            </div>
        );
    }

    const reports = await db.selectFrom("user_reports")
        .leftJoin("user as reporter", "reporter.id", "user_reports.reporter_id")
        .leftJoin("user as reported", "reported.id", "user_reports.reported_id")
        .leftJoin("quarries", "quarries.id", "user_reports.quarry_id")
        .leftJoin("quarries as escalated_from_quarry", "escalated_from_quarry.id", "user_reports.escalated_from_quarry_id")
        .select([
            "user_reports.target_id", "user_reports.target_type",
            "user_reports.id", "user_reports.reason", "user_reports.status", "user_reports.created_at",
            "user_reports.reporter_id", "user_reports.reported_id", "user_reports.target_preview", "user_reports.context_snapshot", "user_reports.context_size",
            "reporter.name as reporter_name", "reporter.displayUsername as reporter_username",
            "reported.name as reported_name", "reported.displayUsername as reported_username",
            "quarries.name as quarry_name",
            "escalated_from_quarry.name as escalated_from_quarry_name"
        ])
        .where((eb) => eb.or([
            eb("status", "=", "pending"),
            eb("status", "=", "escalated"),
        ]))
        .orderBy("created_at", "desc")
        .execute();

    async function dismissReport(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const isAdminUser = await isGlobalAdmin(session.user.id);
        if (!isAdminUser) return;
        if (isRateLimited(session.user.id, "admin_dismiss_report", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const id = formData.get("id") as string;
        await db.updateTable("user_reports").set({ status: "dismissed" }).where("id", "=", id).execute();
        revalidatePath("/admin/reports");
    }

    return (
        <div className="page-shell max-w-6xl space-y-8">
            <section className="soft-panel mt-12 p-6 sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trust and safety</p>
                        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Global reports queue</h1>
                        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Review escalated user, content, and moderation incidents from across the instance, with attached context preserved for quick triage.</p>
                    </div>
                    <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
                        {reports.length} open report{reports.length === 1 ? '' : 's'}
                    </div>
                </div>
            </section>

            <div className="space-y-6">
                {reports.map(r => (
                    <article key={r.id} className="soft-panel p-5 sm:p-6">
                        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white ${r.status === "escalated" ? "bg-amber-500" : "bg-red-500"}`}>{r.status === "escalated" ? "Escalated" : "Reported"}</span>
                                    <span className="text-lg font-semibold text-foreground">{r.reported_username || r.reported_name}</span>
                                    <span className="text-sm text-muted-foreground">reported by {r.reporter_username || r.reporter_name}</span>
                                </div>
                                {r.quarry_name && (
                                    <p className="mt-2 text-sm text-muted-foreground">In q/{r.quarry_name}</p>
                                )}
                                {!r.quarry_name && r.escalated_from_quarry_name && (
                                    <p className="mt-2 text-sm text-muted-foreground">Escalated from q/{r.escalated_from_quarry_name}</p>
                                )}
                            </div>
                            <div className="rounded-full border border-border/70 bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                            </div>
                        </div>
                        {r.target_preview && (
                            <div className="mb-4 rounded-[20px] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                                {r.target_preview}
                            </div>
                        )}
                        <div className="mb-4 rounded-[20px] border border-red-500/35 bg-red-500/5 px-4 py-4 text-sm whitespace-pre-wrap text-foreground">
                            {r.reason}
                        </div>
                        {r.context_snapshot && (
                            <div className="mb-4 rounded-[20px] border border-border/70 bg-card/60 p-4">
                                <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Attached chat context{r.context_size ? ` (${r.context_size} messages)` : ""}</div>
                                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{r.context_snapshot}</pre>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-3">
                            <form action={dismissReport}>
                                <input type="hidden" name="id" value={r.id} />
                                <button type="submit" className="inline-flex h-10 items-center justify-center rounded-full border border-border/70 px-4 text-sm font-semibold text-foreground transition hover:border-foreground hover:bg-foreground hover:text-background cursor-pointer">
                                    Dismiss
                                </button>
                            </form>
                            <form action={async (formData) => {
                                "use server";
                                const rawHeaders = await headers();
                                const session = await auth.api.getSession({ headers: rawHeaders });
                                if (!session?.user || !(await isGlobalAdmin(session.user.id))) return;
                                if (isRateLimited(session.user.id, "admin_ban_report_target", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

                                const id = formData.get("id") as string;
                                const reported_id = formData.get("reported_id") as string;

                                await db.updateTable("user_reports").set({ status: "actioned" }).where("id", "=", id).execute();
                                const { generateUUID } = await import("@/lib/utils");
                                await db.insertInto("bans_and_timeouts").values({
                                    id: generateUUID(),
                                    user_id: reported_id,
                                    issued_by_id: session.user.id,
                                    reason: "Platform Violations",
                                    status: "active"
                                }).execute();

                                revalidatePath("/admin/reports");
                            }}>
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="reported_id" value={r.reported_id!} />
                                <button type="submit" className="inline-flex h-10 items-center justify-center rounded-full border border-red-500/50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-500 hover:text-white cursor-pointer">
                                    Action (Ban)
                                </button>
                            </form>
                        </div>
                    </article>
                ))}

                {reports.length === 0 && (
                    <section className="soft-panel p-12 text-center">
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Queue clear</h2>
                        <p className="mt-3 text-sm text-muted-foreground">There are no pending or escalated reports right now.</p>
                    </section>
                )}
            </div>
        </div>
    );
}
