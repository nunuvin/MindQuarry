import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteUserAccount } from "@/lib/accounts";
import { isGlobalAdmin } from "@/lib/admin";
import { listPostingPolicies, upsertPostingPolicy } from "@/lib/moderation";
import { getSiteSettings } from "@/lib/settings";
import { isRateLimited } from "@/lib/rateLimit";
import { generateSecureTemporaryPassword } from "@/lib/passwords";
import { MindQuarryConfig } from "@/lib/config";
import { SecurityRateLimits } from "@/lib/security";
import { AdminPasswordResetPanel, type AdminPasswordResetActionState } from "./AdminPasswordResetPanel";

export default async function AdminUsersPage() {
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
                    <p className="mt-3 text-sm text-muted-foreground">Only instance administrators can manage global admins, moderation policy, or account resets.</p>
                </section>
            </div>
        );
    }

    const [settings, admins, instancePolicies] = await Promise.all([
        getSiteSettings(),
        db.selectFrom("global_admins")
            .innerJoin("user", "user.id", "global_admins.user_id")
            .select(["global_admins.user_id", "user.name", "user.displayUsername", "user.username"])
            .execute(),
        listPostingPolicies({}),
    ]);

    const firstAdmin = settings?.first_admin_user_id ? await db.selectFrom("user").select(["id", "name", "displayUsername", "username"]).where("id", "=", settings.first_admin_user_id).executeTakeFirst() : null;

    async function addAdmin(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !(await isGlobalAdmin(session.user.id))) return;
        if (isRateLimited(session.user.id, "admin_add_global_admin", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const username = formData.get("username") as string;
        if (!username) return;

        const user = await db.selectFrom("user").select("id").where("username", "=", username).executeTakeFirst();
        if (user) {
            await db.insertInto("global_admins").values({
                user_id: user.id,
                granted_by_id: session.user.id
            }).execute().catch(()=>null); // Ignore unique constraint errors
            revalidatePath("/admin/users");
        }
    }

    async function removeAdmin(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !(await isGlobalAdmin(session.user.id))) return;
        if (isRateLimited(session.user.id, "admin_remove_global_admin", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const userId = formData.get("user_id") as string;
        const settings = await getSiteSettings();

        // Prevent removing the first admin
        if (userId === settings?.first_admin_user_id) return;

        await db.deleteFrom("global_admins").where("user_id", "=", userId).execute();
        revalidatePath("/admin/users");
    }

    async function saveInstancePolicy(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !(await isGlobalAdmin(session.user.id))) return;
        if (isRateLimited(session.user.id, "admin_save_instance_policy", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const username = ((formData.get("username") as string) || "").trim();
        const reviewMode = (formData.get("review_mode") as string) || "none";
        const canPostQueries = formData.get("can_post_queries") === "on";
        const canPostAnswers = formData.get("can_post_answers") === "on";

        const targetUser = username
            ? await db.selectFrom("user").select("id").where("username", "=", username).executeTakeFirst()
            : null;

        if (username && !targetUser?.id) {
            return;
        }

        await upsertPostingPolicy({
            actorUserId: session.user.id,
            userId: targetUser?.id || null,
            reviewMode,
            canPostQueries,
            canPostAnswers,
        });

        revalidatePath("/admin/users");
    }

    async function deleteUser(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !(await isGlobalAdmin(session.user.id))) return;
        if (isRateLimited(session.user.id, "admin_delete_user", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const username = (formData.get("username") as string) || "";
        if (!username) return;

        const user = await db.selectFrom("user")
            .select(["id", "username"])
            .where("username", "=", username)
            .executeTakeFirst();
        if (!user?.id) return;

        await deleteUserAccount({
            actorUserId: session.user.id,
            targetUserId: user.id,
            allowAdminDelete: true,
            protectedUserIds: settings?.first_admin_user_id ? [settings.first_admin_user_id] : [],
        });

        revalidatePath("/admin/users");
    }

    async function resetUserPassword(
        _previousState: AdminPasswordResetActionState,
        formData: FormData,
    ): Promise<AdminPasswordResetActionState> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !(await isGlobalAdmin(session.user.id))) {
            return { status: "error", message: "Only instance admins can reset passwords." };
        }
        if (isRateLimited(session.user.id, "admin_reset_user_password", SecurityRateLimits.ADMIN_MUTATIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            return { status: "error", message: "Password resets are temporarily rate limited. Try again in a moment." };
        }

        const username = ((formData.get("username") as string) || "").trim();
        const rawLength = Number(formData.get("password_length"));
        const passwordLength = Number.isFinite(rawLength) ? rawLength : 16;
        if (!username) {
            return { status: "error", message: "Username is required." };
        }

        const targetUser = await db.selectFrom("user")
            .select(["id", "username"])
            .where("username", "=", username)
            .executeTakeFirst();

        if (!targetUser?.id) {
            return { status: "error", message: "That user was not found." };
        }

        const temporaryPassword = generateSecureTemporaryPassword(passwordLength);

        try {
            await auth.api.setUserPassword({
                body: {
                    userId: targetUser.id,
                    newPassword: temporaryPassword,
                },
                headers: rawHeaders,
            });

            await db.insertInto("profiles")
                .values({ user_id: targetUser.id })
                .onConflict((oc) => oc.column("user_id").doNothing())
                .execute();

            await db.updateTable("profiles")
                .set({
                    force_password_reset: true,
                    updated_at: new Date(),
                })
                .where("user_id", "=", targetUser.id)
                .execute();

            revalidatePath("/admin/users");
            return {
                status: "success",
                message: "Temporary password generated. Share it securely with the user.",
                temporaryPassword,
                targetUsername: targetUser.username || username,
            };
        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error && error.message ? error.message : "Unable to reset that password.",
            };
        }
    }

    return (
        <div className="page-shell max-w-6xl space-y-8">
            <section className="soft-panel mt-12 p-6 sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Instance control</p>
                        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Global admin management</h1>
                        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Promote trusted operators, tune instance-wide posting policy, and handle account recovery or removal from one place.</p>
                    </div>
                    <div className="rounded-[20px] border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-700 dark:text-sky-300">
                        {admins.length} active admin{admins.length === 1 ? '' : 's'}
                    </div>
                </div>
            </section>

            <section className="soft-panel p-6 sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Add a new admin</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Promotions take effect immediately once the username resolves to an existing account.</p>
                    </div>
                    <form action={addAdmin} className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl">
                        <input name="username" required placeholder="Exact username" className="h-11 flex-1 rounded-full border border-border/70 bg-card px-4 text-sm outline-none transition focus:border-sky-400/70 focus:ring-4 focus:ring-sky-500/10" />
                        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-full border border-sky-500/40 bg-sky-500 px-5 text-sm font-semibold text-white transition hover:bg-sky-600 cursor-pointer">
                            Add Admin
                        </button>
                    </form>
                </div>
            </section>

            <section className="soft-panel p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Current admins</h2>
                        <p className="mt-2 text-sm text-muted-foreground">The founder account remains protected, while other global admins can be rotated as needed.</p>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    {firstAdmin && (
                        <article className="rounded-[24px] border border-sky-500/35 bg-sky-500/10 p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-lg font-semibold text-foreground">{firstAdmin.displayUsername || firstAdmin.username || firstAdmin.name}</span>
                                        <span className="rounded-full border border-sky-500/40 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Founder</span>
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground">This account is pinned as the bootstrap admin in site settings and cannot be removed from here.</p>
                                </div>
                                <div className="rounded-full border border-border/70 bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Protected</div>
                            </div>
                        </article>
                    )}

                    {admins.map(a => (
                        <article key={a.user_id} className="rounded-[24px] border border-border/70 bg-card/70 p-5 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-lg font-semibold text-foreground">{a.displayUsername || a.username || a.name}</span>
                                        <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin</span>
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground">@{a.username || a.user_id}</p>
                                </div>
                                <form action={removeAdmin}>
                                    <input type="hidden" name="user_id" value={a.user_id} />
                                    <button type="submit" className="inline-flex h-10 items-center justify-center rounded-full border border-red-500/40 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-500 hover:text-white cursor-pointer">
                                        Remove
                                    </button>
                                </form>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
                <section className="soft-panel p-6 sm:p-8">
                    <div className="flex flex-col gap-2">
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Instance posting policy</h2>
                        <p className="text-sm text-muted-foreground">Set a default moderation posture or target a specific user with a stricter review mode.</p>
                    </div>

                    <form action={saveInstancePolicy} className="mt-6 space-y-4">
                        <input name="username" placeholder="Exact username or leave blank for default" className="h-11 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none transition focus:border-sky-400/70 focus:ring-4 focus:ring-sky-500/10" />
                        <select name="review_mode" defaultValue="none" className="h-11 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none transition focus:border-sky-400/70 focus:ring-4 focus:ring-sky-500/10">
                            <option value="none">No review</option>
                            <option value="query">Review queries only</option>
                            <option value="query_and_answer">Review queries and answers</option>
                        </select>
                        <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground"><input type="checkbox" name="can_post_queries" defaultChecked className="h-4 w-4 rounded border-border" /> Allow queries</label>
                        <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground"><input type="checkbox" name="can_post_answers" defaultChecked className="h-4 w-4 rounded border-border" /> Allow answers</label>
                        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-full border border-sky-500/40 bg-sky-500 px-5 text-sm font-semibold text-white transition hover:bg-sky-600 cursor-pointer">
                            Save Policy
                        </button>
                    </form>

                    <div className="mt-6 space-y-3 text-sm">
                        {instancePolicies.map((policy) => (
                            <article key={policy.id} className="rounded-[20px] border border-border/70 bg-card/70 px-4 py-3">
                                <div className="font-semibold text-foreground">{policy.username || policy.displayUsername || policy.name || "Instance default"}</div>
                                <div className="mt-1 text-muted-foreground">Review: {policy.review_mode || "none"} · Queries: {policy.can_post_queries ? "allowed" : "blocked"} · Answers: {policy.can_post_answers ? "allowed" : "blocked"}</div>
                            </article>
                        ))}
                    </div>
                </section>

                <AdminPasswordResetPanel action={resetUserPassword} />

                <section className="soft-panel border-red-500/30 bg-red-500/5 p-6 sm:p-8 lg:col-start-2">
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-red-600">Delete user</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Use this only when an account must be removed entirely. Auth credentials and profile data are deleted, but authored content is preserved under the deleted-user placeholder.</p>
                    <form action={deleteUser} className="space-y-4">
                        <input name="username" required placeholder="Exact username to delete" className="h-11 w-full rounded-2xl border border-red-500/50 bg-card px-4 text-sm outline-none transition focus:ring-4 focus:ring-red-500/10" />
                        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-full border border-red-500/50 px-5 text-sm font-semibold text-red-600 transition hover:bg-red-500 hover:text-white cursor-pointer">
                            Delete User Account
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
