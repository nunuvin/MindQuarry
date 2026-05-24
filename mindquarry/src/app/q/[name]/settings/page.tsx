import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { addQuarryTags, getAvailableTagsForQuarry } from "@/lib/tags";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";
import { canAdministerQuarry, listPostingPolicies, upsertPostingPolicy } from "@/lib/moderation";

export default async function QuarrySettingsPage({ params }: { params: Promise<{ name: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const availableTags = await getAvailableTagsForQuarry(quarry.id, quarry.name || resolvedParams.name);
    const globalTags = availableTags.filter((tag) => tag.quarry_id === null);
    const quarryTags = availableTags.filter((tag) => tag.quarry_id === quarry.id);
    const quarryPolicies = await listPostingPolicies({ quarryId: quarry.id });

    // Verify user is an admin of this quarry
    const membership = await db.selectFrom("quarry_members")
        .selectAll()
        .where("quarry_id", "=", quarry.id)
        .where("user_id", "=", session.user.id)
        .executeTakeFirst();

    if (!membership || !canAdministerQuarry(membership.role)) {
        return (
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border rounded shadow">
                <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
                <p>You must be a Quarry Admin to view this page.</p>
                <Link href={`/q/${quarry.name}`} className="mt-4 block text-blue-500 hover:underline">Return to q/{quarry.name}</Link>
            </div>
        );
    }

    async function updateQuarry(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || membership.role !== 'admin') return;

        const description = formData.get("description") as string;
        const visibility = (formData.get("visibility") as string) || "public";
        const is_invite_only = visibility === "members";
        const custom_ban_template = formData.get("custom_ban_template") as string;
        const allow_user_tags = formData.get("allow_user_tags") === "on";
        const content_review_mode = (formData.get("content_review_mode") as string) || "none";
        const quarry_tags = (formData.get("quarry_tags") as string | null) || "";

        if (isRateLimited(
            session.user.id,
            `update_quarry_settings:${quarry!.id}`,
            MindQuarryConfig.QUARRIES.MAX_SETTINGS_UPDATES_PER_MIN,
            MindQuarryConfig.RATE_LIMIT_WINDOW_MS,
        )) {
            console.warn(`User ${session.user.id} rate limited on quarry settings updates.`);
            return;
        }

        await db.updateTable("quarries").set({ description, visibility, is_invite_only, allow_user_tags, content_review_mode, custom_ban_template: custom_ban_template || null }).where("id", "=", quarry!.id).execute();
        await addQuarryTags(quarry!.id, quarry!.name || resolvedParams.name, quarry_tags, session.user.id);
        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath(`/q/${quarry!.name}/settings`);
        revalidatePath(`/q/${quarry!.name}/submit`);
    }

    async function saveRole(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || !canAdministerQuarry(membership.role)) return;

        const username = ((formData.get("username") as string) || "").trim();
        const role = (formData.get("role") as string) || "member";
        if (!username) return;

        const user = await db.selectFrom("user").select("id").where("username", "=", username).executeTakeFirst();
        if (!user?.id) return;

        const existing = await db.selectFrom("quarry_members").select("user_id").where("quarry_id", "=", quarry!.id).where("user_id", "=", user.id).executeTakeFirst();

        if (existing) {
            await db.updateTable("quarry_members").set({ role }).where("quarry_id", "=", quarry!.id).where("user_id", "=", user.id).execute();
        } else {
            await db.insertInto("quarry_members").values({ quarry_id: quarry!.id, user_id: user.id, role }).execute();
        }

        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath(`/q/${quarry!.name}/settings`);
    }

    async function saveQuarryPolicy(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || !canAdministerQuarry(membership.role)) return;

        const username = ((formData.get("username") as string) || "").trim();
        const reviewMode = (formData.get("review_mode") as string) || "none";
        const canPostQueries = formData.get("can_post_queries") === "on";
        const canPostAnswers = formData.get("can_post_answers") === "on";

        const targetUser = username
            ? await db.selectFrom("user").select("id").where("username", "=", username).executeTakeFirst()
            : null;

        if (username && !targetUser?.id) return;

        await upsertPostingPolicy({
            actorUserId: session.user.id,
            quarryId: quarry!.id,
            userId: targetUser?.id || null,
            reviewMode,
            canPostQueries,
            canPostAnswers,
        });

        revalidatePath(`/q/${quarry!.name}/settings`);
        revalidatePath(`/q/${quarry!.name}/submit`);
    }

    return (
        <div className="page-shell max-w-4xl">
            <Link href={`/q/${quarry.name}`} className="soft-button mb-4 gap-2 rounded-full px-4 py-2">&larr; Back to q/{quarry.name}</Link>

            <div className="soft-panel p-8 sm:p-10">
                <h1 className="font-display mb-8 border-b border-border/70 pb-3 text-3xl font-semibold tracking-tight">q/{quarry.name} Settings</h1>

                <form action={updateQuarry} className="space-y-6">
                    <div>
                        <label className="mb-2 block text-sm font-semibold">Description</label>
                        <textarea name="description" rows={4} defaultValue={quarry.description || ""} className="w-full rounded-3xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold">Visibility</label>
                        <select name="visibility" defaultValue={quarry.visibility || (quarry.is_invite_only ? "members" : "public")} className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500">
                            <option value="public">Public</option>
                            <option value="authenticated">Signed-in users only</option>
                            <option value="members">Members only</option>
                        </select>
                        <p className="mt-2 text-xs text-muted-foreground">Members-only quarries require both an account and membership to view the threads inside.</p>
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-medium">
                        <input type="checkbox" name="allow_user_tags" defaultChecked={quarry.allow_user_tags ?? false} className="h-4 w-4" />
                        Allow members to create custom tags on new queries
                    </label>

                    <div>
                        <label className="mb-2 block text-sm font-semibold">Content Review Mode</label>
                        <select name="content_review_mode" defaultValue={quarry.content_review_mode || "none"} className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500">
                            <option value="none">No review required</option>
                            <option value="query">Review queries before publishing</option>
                            <option value="query_and_answer">Review queries and answers before publishing</option>
                        </select>
                        <p className="mt-2 text-xs text-muted-foreground">Per-user overrides can make this stricter or silence users entirely.</p>
                    </div>

                    <div className="rounded-3xl border border-border/70 p-4">
                        <label className="mb-2 block text-sm font-semibold">Add Quarry Tags</label>
                        <p className="mb-3 text-xs text-muted-foreground">Comma-separated tags become available only inside this quarry.</p>
                        <input name="quarry_tags" className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" placeholder="e.g. query-optimizer, answer-review, moderation" />
                    </div>

                    <div className="grid gap-4 rounded-3xl border border-border/70 p-4 md:grid-cols-2">
                        <div>
                            <p className="mb-3 text-sm font-semibold">Instance Tags</p>
                            <div className="flex flex-wrap gap-2">
                                {globalTags.map((tag) => (
                                    <span key={tag.id} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">{tag.name}</span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="mb-3 text-sm font-semibold">Quarry Tags</p>
                            <div className="flex flex-wrap gap-2">
                                {quarryTags.length === 0 && <span className="text-xs text-muted-foreground">No quarry-specific tags yet.</span>}
                                {quarryTags.map((tag) => (
                                    <span key={tag.id} className="rounded-full border border-sky-400/60 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">{tag.name}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4 text-sm font-semibold">
                        <Link href={`/q/${quarry.name}/mod/queue`} className="text-sky-600 hover:underline">Open Mod Queue</Link>
                        <Link href={`/q/${quarry.name}/mod/history`} className="text-sky-600 hover:underline">Open Mod History</Link>
                    </div>

                    <div className="pt-6 border-t border-border/70">
                        <label className="mb-2 block text-sm font-semibold">Custom Ban Template</label>
                        <p className="text-xs text-muted-foreground mb-2">Overrides the global template when banning users from this specific Quarry.</p>
                        <textarea name="custom_ban_template" rows={3} defaultValue={quarry.custom_ban_template || ""} placeholder="Leave blank to use global defaults." className="w-full rounded-3xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                    </div>

                    <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">
                        Save Settings
                    </button>
                </form>

                <div className="mt-10 grid gap-8 border-t border-border/70 pt-8 md:grid-cols-2">
                    <div className="rounded-3xl border border-border/70 p-5">
                        <h2 className="mb-4 text-lg font-semibold">Team Roles</h2>
                        <form action={saveRole} className="space-y-4">
                            <input name="username" required className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" placeholder="Exact username" />
                            <select name="role" defaultValue="moderator" className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500">
                                <option value="member">Member</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button type="submit" className="soft-button-primary rounded-full px-5 py-3">Save Role</button>
                        </form>
                    </div>

                    <div className="rounded-3xl border border-border/70 p-5">
                        <h2 className="mb-4 text-lg font-semibold">Per-User Posting Policy</h2>
                        <form action={saveQuarryPolicy} className="space-y-4">
                            <input name="username" placeholder="Exact username or leave blank for quarry default" className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" />
                            <select name="review_mode" defaultValue={quarry.content_review_mode || "none"} className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500">
                                <option value="none">No review</option>
                                <option value="query">Review queries</option>
                                <option value="query_and_answer">Review queries and answers</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="can_post_queries" defaultChecked className="h-4 w-4" /> Allow queries</label>
                            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="can_post_answers" defaultChecked className="h-4 w-4" /> Allow answers</label>
                            <button type="submit" className="soft-button-primary rounded-full px-5 py-3">Save Posting Policy</button>
                        </form>
                        <div className="mt-5 space-y-3 text-sm">
                            {quarryPolicies.map((policy) => (
                                <div key={policy.id} className="rounded-2xl border border-border/70 px-3 py-2">
                                    <div className="font-semibold">{policy.username || policy.displayUsername || policy.name || "Quarry default"}</div>
                                    <div className="text-muted-foreground">Review: {policy.review_mode || "none"} · Queries: {policy.can_post_queries ? "allowed" : "blocked"} · Answers: {policy.can_post_answers ? "allowed" : "blocked"}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
