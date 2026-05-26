import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSiteSettings } from "@/lib/settings";
import { isGlobalAdmin } from "@/lib/admin";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";
import { SecurityRateLimits } from "@/lib/security";

export default async function AdminDashboardPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const settings = await getSiteSettings();

    // Set first admin if empty
    if (settings && !settings.first_admin_user_id) {
        const firstUser = await db.selectFrom("user").select("id").orderBy("createdAt", "asc").executeTakeFirst();
        if (firstUser) {
            await db.updateTable("site_settings").set({ first_admin_user_id: firstUser.id }).where("id", "=", 1).execute();
            settings.first_admin_user_id = firstUser.id;
        }
    }

    const isAdmin = await isGlobalAdmin(session.user.id);

    if (!isAdmin) {
        return (
            <div className="page-shell">
                <div className="soft-panel max-w-3xl p-8">
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-red-500">Instance</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Access denied</h1>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">You must be a global administrator to open the instance control room.</p>
                </div>
            </div>
        );
    }

    async function toggleSimplifiedMode() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const isAdminUser = await isGlobalAdmin(session.user.id);
        if (!isAdminUser) return;
        if (isRateLimited(session.user.id, "admin_toggle_simplified_mode", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const current = await db.selectFrom("site_settings").select("simplified_mode_enabled").where("id", "=", 1).executeTakeFirst();
        await db.updateTable("site_settings").set({ simplified_mode_enabled: !current?.simplified_mode_enabled }).where("id", "=", 1).execute();
        revalidatePath("/admin");
    }

    async function toggleRegistration() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const isAdminUser = await isGlobalAdmin(session.user.id);
        if (!isAdminUser) return;
        if (isRateLimited(session.user.id, "admin_toggle_registration", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const current = await db.selectFrom("site_settings").select("registration_enabled").where("id", "=", 1).executeTakeFirst();
        await db.updateTable("site_settings").set({ registration_enabled: !current?.registration_enabled }).where("id", "=", 1).execute();
        revalidatePath("/admin");
    }

    async function updateBanTemplate(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const isAdminUser = await isGlobalAdmin(session.user.id);
        if (!isAdminUser) return;
        if (isRateLimited(session.user.id, "admin_update_ban_template", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const template = formData.get("template") as string;
        await db.updateTable("site_settings").set({ global_ban_template: template }).where("id", "=", 1).execute();
        revalidatePath("/admin");
    }

    async function updateChatReportContextSize(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const isAdminUser = await isGlobalAdmin(session.user.id);
        if (!isAdminUser) return;
        if (isRateLimited(session.user.id, "admin_update_chat_report_context", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const rawSize = Number(formData.get("chat_report_context_size"));
        const chatReportContextSize = Number.isFinite(rawSize)
            ? Math.max(1, Math.min(500, Math.floor(rawSize)))
            : 100;

        await db.updateTable("site_settings")
            .set({ chat_report_context_size: chatReportContextSize })
            .where("id", "=", 1)
            .execute();
        revalidatePath("/admin");
    }

    return (
        <div className="page-shell max-w-6xl">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-red-500">Instance Admin</p>
                    <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight">Global Admin Panel</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">Tune site-wide behavior, registration, moderation defaults, and report context without the older brutalist shell fighting the sidebar layout.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="soft-card min-w-[11rem] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Registration</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">{settings?.registration_enabled ? "Open" : "Closed"}</div>
                    </div>
                    <div className="soft-card min-w-[11rem] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Messaging Mode</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">{settings?.simplified_mode_enabled ? "Simplified" : "Full"}</div>
                    </div>
                    <div className="soft-card min-w-[11rem] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Chat Report Context</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">{settings?.chat_report_context_size || 100} msgs</div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                <section className="soft-panel p-6 sm:p-8">
                    <div className="mb-6 border-b border-border/70 pb-4">
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Site switches</p>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Core settings</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="soft-card flex items-center justify-between gap-4 p-5">
                            <div>
                                <h3 className="text-lg font-semibold">Simplified Mode</h3>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">Turns off direct messages and custom quarry creation for a reduced-complexity setup.</p>
                            </div>
                            <form action={toggleSimplifiedMode}>
                                <button className={`inline-flex min-w-28 justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition ${settings?.simplified_mode_enabled ? 'bg-sky-600 shadow-[0_16px_28px_-18px_rgba(14,116,144,0.75)]' : 'bg-slate-700 shadow-[0_16px_28px_-18px_rgba(51,65,85,0.7)] hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white'}`}>
                                    {settings?.simplified_mode_enabled ? "Enabled" : "Disabled"}
                                </button>
                            </form>
                        </div>
                        <div className="soft-card flex items-center justify-between gap-4 p-5">
                            <div>
                                <h3 className="text-lg font-semibold">Registration</h3>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">Control whether new accounts can be created on the instance right now.</p>
                            </div>
                            <form action={toggleRegistration}>
                                <button className={`inline-flex min-w-28 justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition ${settings?.registration_enabled ? 'bg-emerald-600 shadow-[0_16px_28px_-18px_rgba(5,150,105,0.7)]' : 'bg-rose-600 shadow-[0_16px_28px_-18px_rgba(225,29,72,0.7)]'}`}>
                                    {settings?.registration_enabled ? "Open" : "Closed"}
                                </button>
                            </form>
                        </div>
                    </div>
                </section>

                <section className="soft-panel p-6 sm:p-8">
                    <div className="mb-6 border-b border-border/70 pb-4">
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Moderation</p>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Global ban template</h2>
                    </div>
                    <form action={updateBanTemplate} className="space-y-4">
                        <textarea
                            name="template"
                            rows={4}
                            defaultValue={settings?.global_ban_template || ""}
                            placeholder="Default message sent to users upon global ban..."
                            className="min-h-40 w-full rounded-[24px] border border-border/70 bg-card/80 px-5 py-4 text-sm leading-7 outline-none transition focus:border-sky-400/70 focus:ring-4 focus:ring-sky-500/10"
                        />
                        <button type="submit" className="soft-button-primary rounded-full px-6 py-3">
                            Save Template
                        </button>
                    </form>
                </section>

                <section className="soft-panel p-6 sm:p-8">
                    <div className="mb-6 border-b border-border/70 pb-4">
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Messaging</p>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Chat report context</h2>
                    </div>
                    <form action={updateChatReportContextSize} className="space-y-4">
                        <input
                            type="number"
                            min={1}
                            max={500}
                            name="chat_report_context_size"
                            defaultValue={settings?.chat_report_context_size || 100}
                            className="h-12 w-full max-w-xs rounded-2xl border border-border/70 bg-card/80 px-4 text-sm font-medium outline-none transition focus:border-sky-400/70 focus:ring-4 focus:ring-sky-500/10"
                        />
                        <p className="text-sm leading-7 text-muted-foreground">Choose how many recent chat messages are attached when a conversation or single message is reported to instance admins.</p>
                        <button type="submit" className="soft-button-primary rounded-full px-6 py-3">
                            Save Context Size
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
