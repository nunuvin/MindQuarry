import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteUserAccount } from "@/lib/accounts";
import { isGlobalAdmin } from "@/lib/admin";
import { listPostingPolicies, upsertPostingPolicy } from "@/lib/moderation";
import { getSiteSettings } from "@/lib/settings";

export default async function AdminUsersPage() {
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

    return (
        <div className="max-w-5xl mx-auto mt-12 p-6 bg-card border-[3px] border-black rounded-none shadow-[8px_8px_0_0_#000] dark:border-white dark:shadow-[8px_8px_0_0_#fff]">
            <h1 className="text-3xl font-black uppercase mb-8 border-b-[3px] border-black dark:border-white pb-2">Global Admins</h1>

            <div className="mb-8 p-6 bg-muted/30 border-2 border-black dark:border-white">
                <h2 className="font-bold mb-4 uppercase">Add New Admin</h2>
                <form action={addAdmin} className="flex gap-4">
                    <input name="username" required placeholder="Exact Username..." className="flex-1 p-2 border-2 border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" className="px-6 py-2 bg-blue-500 text-white font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all cursor-pointer">
                        Add Admin
                    </button>
                </form>
            </div>

            <div className="space-y-4">
                {firstAdmin && (
                    <div className="flex justify-between items-center p-4 border-2 border-black dark:border-white bg-blue-50 dark:bg-blue-950">
                        <div>
                            <span className="font-bold text-lg">{firstAdmin.displayUsername || firstAdmin.username || firstAdmin.name}</span>
                            <span className="ml-2 text-xs uppercase bg-black text-white px-2 py-1 font-bold">Founder / First Admin</span>
                        </div>
                        <div className="text-muted-foreground text-sm font-bold uppercase italic">Cannot be removed</div>
                    </div>
                )}

                {admins.map(a => (
                    <div key={a.user_id} className="flex justify-between items-center p-4 border-2 border-black dark:border-white">
                        <div>
                            <span className="font-bold text-lg">{a.displayUsername || a.username || a.name}</span>
                            <span className="ml-2 text-xs uppercase border-2 border-black dark:border-white px-2 py-1 font-bold">Admin</span>
                        </div>
                        <form action={removeAdmin}>
                            <input type="hidden" name="user_id" value={a.user_id} />
                            <button type="submit" className="px-4 py-2 text-red-500 font-bold border-2 border-red-500 hover:bg-red-500 hover:text-white cursor-pointer shadow-[2px_2px_0_0_#ef4444]">
                                Remove
                            </button>
                        </form>
                    </div>
                ))}
            </div>

            <div className="mt-10 grid gap-8 border-t-[3px] border-black pt-8 dark:border-white md:grid-cols-2">
                <div className="p-6 bg-muted/30 border-2 border-black dark:border-white">
                    <h2 className="font-bold mb-4 uppercase">Instance Posting Policy</h2>
                    <form action={saveInstancePolicy} className="space-y-4">
                        <input name="username" placeholder="Exact username or leave blank for default" className="w-full p-2 border-2 border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500" />
                        <select name="review_mode" defaultValue="none" className="w-full p-2 border-2 border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="none">No review</option>
                            <option value="query">Review queries only</option>
                            <option value="query_and_answer">Review queries and answers</option>
                        </select>
                        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="can_post_queries" defaultChecked className="h-4 w-4" /> Allow queries</label>
                        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="can_post_answers" defaultChecked className="h-4 w-4" /> Allow answers</label>
                        <button type="submit" className="px-6 py-2 bg-blue-500 text-white font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all cursor-pointer">
                            Save Policy
                        </button>
                    </form>
                    <div className="mt-6 space-y-3 text-sm">
                        {instancePolicies.map((policy) => (
                            <div key={policy.id} className="border-2 border-black/20 px-3 py-2 dark:border-white/20">
                                <div className="font-bold">{policy.username || policy.displayUsername || policy.name || "Instance default"}</div>
                                <div className="text-muted-foreground">Review: {policy.review_mode || "none"} · Queries: {policy.can_post_queries ? "allowed" : "blocked"} · Answers: {policy.can_post_answers ? "allowed" : "blocked"}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 bg-red-500/5 border-2 border-red-500/40">
                    <h2 className="font-bold mb-4 uppercase text-red-600">Delete User</h2>
                    <form action={deleteUser} className="space-y-4">
                        <input name="username" required placeholder="Exact username to delete" className="w-full p-2 border-2 border-red-500 bg-card outline-none focus:ring-2 focus:ring-red-500" />
                        <p className="text-sm text-muted-foreground">This removes the auth account and profile, while preserving authored content under the deleted-user placeholder.</p>
                        <button type="submit" className="px-6 py-2 text-red-600 font-bold border-2 border-red-500 hover:bg-red-500 hover:text-white cursor-pointer shadow-[2px_2px_0_0_#ef4444]">
                            Delete User Account
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
