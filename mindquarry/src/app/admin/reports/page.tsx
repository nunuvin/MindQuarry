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
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border rounded shadow">
                <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
                <p>You must be a Global Administrator to view this page.</p>
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
        <div className="max-w-5xl mx-auto mt-12 p-6 bg-card border-[3px] border-black rounded-none shadow-[8px_8px_0_0_#000] dark:border-white dark:shadow-[8px_8px_0_0_#fff]">
            <h1 className="text-3xl font-black uppercase mb-8 border-b-[3px] border-black dark:border-white pb-2">Global Reports Queue</h1>

            <div className="space-y-6">
                {reports.map(r => (
                    <div key={r.id} className="p-4 border-2 border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className={`font-bold uppercase text-xs px-2 py-1 text-white mr-2 ${r.status === "escalated" ? "bg-amber-500" : "bg-red-500"}`}>{r.status === "escalated" ? "Escalated" : "Reported"}</span>
                                <span className="font-bold">{r.reported_username || r.reported_name}</span>
                                <span className="text-muted-foreground mx-2">by</span>
                                <span className="font-bold">{r.reporter_username || r.reporter_name}</span>
                                {r.quarry_name && (
                                    <span className="text-muted-foreground ml-2">in q/{r.quarry_name}</span>
                                )}
                                {!r.quarry_name && r.escalated_from_quarry_name && (
                                    <span className="text-muted-foreground ml-2">from q/{r.escalated_from_quarry_name}</span>
                                )}
                            </div>
                            <div className="text-sm font-bold text-muted-foreground">
                                {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                            </div>
                        </div>
                        {r.target_preview && (
                            <div className="mb-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                                {r.target_preview}
                            </div>
                        )}
                        <div className="p-4 bg-muted/30 border-l-4 border-red-500 mb-4 whitespace-pre-wrap">
                            {r.reason}
                        </div>
                        {r.context_snapshot && (
                            <div className="mb-4 rounded-2xl border border-border/70 bg-card/60 p-4">
                                <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Attached chat context{r.context_size ? ` (${r.context_size} messages)` : ""}</div>
                                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{r.context_snapshot}</pre>
                            </div>
                        )}
                        <div className="flex gap-4">
                            <form action={dismissReport}>
                                <input type="hidden" name="id" value={r.id} />
                                <button type="submit" className="px-4 py-2 font-bold border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]">
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
                                <button type="submit" className="px-4 py-2 font-bold border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white cursor-pointer shadow-[2px_2px_0_0_#ef4444]">
                                    Action (Ban)
                                </button>
                            </form>
                        </div>
                    </div>
                ))}

                {reports.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                        No pending reports.
                    </div>
                )}
            </div>
        </div>
    );
}
