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

type SettingsTab = "settings" | "team" | "moderation" | "bans";

const SETTINGS_TABS: SettingsTab[] = ["settings", "team", "moderation", "bans"];

export default async function QuarrySettingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ name: string }>;
    searchParams?: Promise<{ tab?: string; status?: string }>;
}) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const resolvedParams = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const activeTab = SETTINGS_TABS.includes((resolvedSearchParams.tab || "") as SettingsTab)
        ? resolvedSearchParams.tab as SettingsTab
        : "settings";

    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const availableTags = await getAvailableTagsForQuarry(quarry.id, quarry.name || resolvedParams.name);
    const globalTags = availableTags.filter((tag) => tag.quarry_id === null);
    const quarryTags = availableTags.filter((tag) => tag.quarry_id === quarry.id);
    const [quarryPolicies, teamMembers] = await Promise.all([
        listPostingPolicies({ quarryId: quarry.id }),
        db.selectFrom("quarry_members")
            .leftJoin("user", "user.id", "quarry_members.user_id")
            .select([
                "quarry_members.user_id",
                "quarry_members.role",
                "user.name",
                "user.displayUsername",
                "user.username",
            ])
            .where("quarry_members.quarry_id", "=", quarry.id)
            .orderBy("quarry_members.role", "asc")
            .orderBy("user.username", "asc")
            .execute(),
    ]);

    const teamByRole = {
        admin: teamMembers.filter((member) => member.role === "admin"),
        moderator: teamMembers.filter((member) => member.role === "moderator"),
        member: teamMembers.filter((member) => member.role === "member"),
    };
    const usernameSuggestions = teamMembers
        .map((member) => member.username)
        .filter((username): username is string => Boolean(username));
    const statusMessage = (() => {
        switch (resolvedSearchParams.status) {
        case "settings-saved":
            return { tone: "sky", message: "Quarry settings saved." };
        case "role-saved":
            return { tone: "sky", message: "Team role updated." };
        case "policy-saved":
            return { tone: "sky", message: "Posting policy saved." };
        case "user-not-found":
            return { tone: "red", message: "That username was not found." };
        case "missing-username":
            return { tone: "red", message: "Enter a username before submitting." };
        default:
            return null;
        }
    })();

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
        redirect(`/q/${quarry!.name}/settings?tab=${content_review_mode === (quarry!.content_review_mode || "none") ? "settings" : "moderation"}&status=settings-saved`);
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
        if (!username) {
            redirect(`/q/${quarry!.name}/settings?tab=team&status=missing-username`);
        }

        const user = await db.selectFrom("user").select("id").where("username", "=", username).executeTakeFirst();
        if (!user?.id) {
            redirect(`/q/${quarry!.name}/settings?tab=team&status=user-not-found`);
        }

        const existing = await db.selectFrom("quarry_members").select("user_id").where("quarry_id", "=", quarry!.id).where("user_id", "=", user.id).executeTakeFirst();

        if (existing) {
            await db.updateTable("quarry_members").set({ role }).where("quarry_id", "=", quarry!.id).where("user_id", "=", user.id).execute();
        } else {
            await db.insertInto("quarry_members").values({ quarry_id: quarry!.id, user_id: user.id, role }).execute();
        }

        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath(`/q/${quarry!.name}/settings`);
        redirect(`/q/${quarry!.name}/settings?tab=team&status=role-saved`);
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

        if (username && !targetUser?.id) {
            redirect(`/q/${quarry!.name}/settings?tab=bans&status=user-not-found`);
        }

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
        redirect(`/q/${quarry!.name}/settings?tab=bans&status=policy-saved`);
    }

    return (
        <div className="page-shell max-w-4xl">
            <Link href={`/q/${quarry.name}`} className="soft-button mb-4 gap-2 rounded-full px-4 py-2">&larr; Back to q/{quarry.name}</Link>

            <div className="soft-panel p-8 sm:p-10">
                <div className="flex flex-col gap-4 border-b border-border/70 pb-6">
                    <h1 className="font-display text-3xl font-semibold tracking-tight">q/{quarry.name} Settings</h1>
                    <div className="flex flex-wrap gap-2">
                        {SETTINGS_TABS.map((tab) => (
                            <Link
                                key={tab}
                                href={`/q/${quarry.name}/settings?tab=${tab}`}
                                className={activeTab === tab ? "soft-button-primary rounded-full px-4 py-2" : "soft-button rounded-full px-4 py-2"}
                            >
                                {tab === "team" ? "Team" : tab === "moderation" ? "Moderation" : tab === "bans" ? "Bans" : "Settings"}
                            </Link>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm font-semibold">
                        <Link href={`/q/${quarry.name}/mod/queue`} className="text-sky-600 hover:underline">Open Mod Queue</Link>
                        <Link href={`/q/${quarry.name}/mod/history`} className="text-sky-600 hover:underline">Open Mod History</Link>
                    </div>
                </div>

                {statusMessage && (
                    <div className={statusMessage.tone === "red"
                        ? "mt-6 rounded-[20px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600"
                        : "mt-6 rounded-[20px] border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-700 dark:text-sky-300"}>
                        {statusMessage.message}
                    </div>
                )}

                {activeTab === "settings" && (
                    <form action={updateQuarry} className="mt-8 space-y-6">
                        <div>
                            <label className="mb-2 block text-sm font-semibold">Description</label>
                            <textarea name="description" rows={4} defaultValue={quarry.description || ""} className="w-full rounded-3xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold">Visibility</label>
                            <select name="visibility" defaultValue={quarry.visibility || (quarry.is_invite_only ? "members" : "public")} className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-sky-500">
                                <option value="public">Public</option>
                                <option value="authenticated">Signed-in users only</option>
                                <option value="members">Members only</option>
                            </select>
                            <p className="mt-2 text-xs text-muted-foreground">Members-only quarries require both an account and membership to view the queries inside.</p>
                        </div>

                        <label className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-medium">
                            <input type="checkbox" name="allow_user_tags" defaultChecked={quarry.allow_user_tags ?? false} className="h-4 w-4" />
                            Allow members to create custom tags on new queries
                        </label>

                        <div className="rounded-3xl border border-border/70 p-4">
                            <label className="mb-2 block text-sm font-semibold">Add Quarry Tags</label>
                            <p className="mb-3 text-xs text-muted-foreground">Comma-separated tags become available only inside this quarry.</p>
                            <input name="quarry_tags" className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" placeholder="e.g. query-optimizer, answer-review, moderation" />
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

                        <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">
                            Save Settings
                        </button>
                    </form>
                )}

                {activeTab === "team" && (
                    <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="rounded-3xl border border-border/70 p-5">
                            <h2 className="mb-4 text-lg font-semibold">Assign Role</h2>
                            <form action={saveRole} className="space-y-4">
                                <input name="username" list="team-username-suggestions" required className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" placeholder="Exact username" />
                                <datalist id="team-username-suggestions">
                                    {usernameSuggestions.map((username) => <option key={username} value={username} />)}
                                </datalist>
                                <select name="role" defaultValue="moderator" className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-sky-500">
                                    <option value="member">Member</option>
                                    <option value="moderator">Moderator</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <button type="submit" className="soft-button-primary rounded-full px-5 py-3">Save Role</button>
                            </form>
                        </div>

                        <div className="space-y-5">
                            {(["admin", "moderator", "member"] as const).map((role) => (
                                <div key={role} className="rounded-3xl border border-border/70 p-5">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h2 className="text-lg font-semibold capitalize">{role === "member" ? "Members" : `${role}s`}</h2>
                                        <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-muted-foreground">{teamByRole[role].length}</span>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        {teamByRole[role].length === 0 && <p className="text-muted-foreground">No {role}s yet.</p>}
                                        {teamByRole[role].map((member) => (
                                            <div key={member.user_id} className="rounded-2xl border border-border/70 px-4 py-3">
                                                <div className="font-semibold">{member.displayUsername || member.username || member.name || member.user_id}</div>
                                                <div className="text-muted-foreground">@{member.username || member.user_id}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "moderation" && (
                    <form action={updateQuarry} className="mt-8 space-y-6">
                        <input type="hidden" name="description" value={quarry.description || ""} readOnly />
                        <input type="hidden" name="visibility" value={quarry.visibility || (quarry.is_invite_only ? "members" : "public")} readOnly />
                        <input type="hidden" name="custom_ban_template" value={quarry.custom_ban_template || ""} readOnly hidden={false} />
                        <input type="hidden" name="quarry_tags" value="" readOnly />
                        {quarry.allow_user_tags ? <input type="hidden" name="allow_user_tags" value="on" readOnly /> : null}
                        <div>
                            <label className="mb-2 block text-sm font-semibold">Content Review Mode</label>
                            <select name="content_review_mode" defaultValue={quarry.content_review_mode || "none"} className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-sky-500">
                                <option value="none">No review required</option>
                                <option value="query">Review queries before publishing</option>
                                <option value="query_and_answer">Review queries and answers before publishing</option>
                            </select>
                            <p className="mt-2 text-xs text-muted-foreground">Per-user overrides can make this stricter or silence users entirely.</p>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold">Custom Ban Template</label>
                            <p className="mb-2 text-xs text-muted-foreground">Overrides the global template when banning users from this specific quarry.</p>
                            <textarea name="custom_ban_template_override" rows={3} defaultValue={quarry.custom_ban_template || ""} className="w-full rounded-3xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                        </div>

                        <button type="submit" formAction={async (formData) => {
                            "use server";
                            formData.set("description", quarry.description || "");
                            formData.set("visibility", quarry.visibility || (quarry.is_invite_only ? "members" : "public"));
                            if (quarry.allow_user_tags) {
                                formData.set("allow_user_tags", "on");
                            }
                            formData.set("quarry_tags", "");
                            formData.set("custom_ban_template", (formData.get("custom_ban_template_override") as string) || "");
                            formData.delete("custom_ban_template_override");
                            await updateQuarry(formData);
                        }} className="soft-button-primary w-full justify-center rounded-full py-3">
                            Save Moderation Settings
                        </button>
                    </form>
                )}

                {activeTab === "bans" && (
                    <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="rounded-3xl border border-border/70 p-5">
                            <h2 className="mb-4 text-lg font-semibold">Posting Policy</h2>
                            <form action={saveQuarryPolicy} className="space-y-4">
                                <input name="username" list="team-username-suggestions" placeholder="Exact username or leave blank for quarry default" className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" />
                                <select name="review_mode" defaultValue={quarry.content_review_mode || "none"} className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-sky-500">
                                    <option value="none">No review</option>
                                    <option value="query">Review queries</option>
                                    <option value="query_and_answer">Review queries and answers</option>
                                </select>
                                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="can_post_queries" defaultChecked className="h-4 w-4" /> Allow queries</label>
                                <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="can_post_answers" defaultChecked className="h-4 w-4" /> Allow answers</label>
                                <button type="submit" className="soft-button-primary rounded-full px-5 py-3">Save Posting Policy</button>
                            </form>
                        </div>

                        <div className="rounded-3xl border border-border/70 p-5">
                            <h2 className="mb-4 text-lg font-semibold">Current Policies</h2>
                            <div className="space-y-3 text-sm">
                                {quarryPolicies.length === 0 && <p className="text-muted-foreground">No quarry-specific policies yet.</p>}
                                {quarryPolicies.map((policy) => (
                                    <div key={policy.id} className="rounded-2xl border border-border/70 px-4 py-3">
                                        <div className="font-semibold">{policy.username || policy.displayUsername || policy.name || "Quarry default"}</div>
                                        <div className="mt-1 text-muted-foreground">Review: {policy.review_mode || "none"} · Queries: {policy.can_post_queries ? "allowed" : "blocked"} · Answers: {policy.can_post_answers ? "allowed" : "blocked"}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
