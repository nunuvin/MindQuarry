import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/accounts";
import { db } from "@/lib/db";

export default async function UserSettingsPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    let profile = await db.selectFrom("profiles").selectAll().where("user_id", "=", session.user.id).executeTakeFirst();
    if (!profile) {
        await db.insertInto("profiles").values({ user_id: session.user.id }).execute();
        profile = await db.selectFrom("profiles").selectAll().where("user_id", "=", session.user.id).executeTakeFirst();
    }

    async function saveSettings(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const bio = formData.get("bio") as string;
        const messagingPrivacy = (formData.get("messaging_privacy") as string) || "anyone";
        const profileVisibility = (formData.get("profile_visibility") as string) || "public";
        const mentionNotifications = (formData.get("mention_notifications") as string) || "all";

        await db.updateTable("profiles")
            .set({
                bio: bio || null,
                messaging_privacy: messagingPrivacy,
                profile_visibility: profileVisibility,
                mention_notifications: mentionNotifications,
                updated_at: new Date(),
            })
            .where("user_id", "=", session.user.id)
            .execute();

        revalidatePath("/settings");
        revalidatePath("/settings/follows");
        revalidatePath("/notifications");
        if (session.user.username) {
            revalidatePath(`/users/${session.user.username}`);
        }
    }

    async function deleteAccount() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const result = await deleteUserAccount({
            actorUserId: session.user.id,
            targetUserId: session.user.id,
        });

        if (!result.ok) {
            return;
        }

        redirect("/login");
    }

    return (
        <div className="page-shell max-w-4xl">
            <div className="soft-panel p-8 sm:p-10">
                <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Settings</p>
                        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Profile Settings</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Control who can see your profile, who can message you, and whether mentions should notify you outside threads you already joined.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/settings/follows" className="soft-button">Things You Follow</Link>
                        <Link href="/notifications" className="soft-button">Notifications</Link>
                    </div>
                </div>

                <form action={saveSettings} className="mt-8 space-y-8">
                    <div>
                        <label className="mb-2 block text-sm font-semibold">Bio</label>
                        <textarea
                            name="bio"
                            rows={5}
                            defaultValue={profile?.bio || ""}
                            className="w-full rounded-3xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="Tell the community about yourself..."
                        />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-semibold">Profile Visibility</label>
                            <select
                                name="profile_visibility"
                                defaultValue={profile?.profile_visibility || "public"}
                                className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="public">Public</option>
                                <option value="authenticated">Anyone with an account</option>
                                <option value="private">Only me</option>
                            </select>
                            <p className="mt-2 text-xs text-muted-foreground">Private profiles stay visible to you, but not to other users.</p>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold">Messaging Privacy</label>
                            <select
                                name="messaging_privacy"
                                defaultValue={profile?.messaging_privacy || "anyone"}
                                className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="anyone">Allow messages from anyone</option>
                                <option value="quarry_members">Only users from joined quarries</option>
                                <option value="mutuals">Only mutual follows</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold">Mention Notifications</label>
                        <select
                            name="mention_notifications"
                            defaultValue={profile?.mention_notifications || "all"}
                            className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            <option value="all">Notify me whenever I am mentioned</option>
                            <option value="interacted_only">Only notify in threads I already interacted with</option>
                        </select>
                        <p className="mt-2 text-xs text-muted-foreground">This keeps direct mention spam down without hiding activity inside discussions you are already part of.</p>
                    </div>

                    <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">
                        Save Changes
                    </button>
                </form>

                <div className="mt-10 rounded-[24px] border border-red-500/30 bg-red-500/5 p-6">
                    <h2 className="font-display text-xl font-semibold tracking-tight text-red-600">Delete Account</h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">Deleting your account removes your login and profile data. Existing queries, answers, and direct messages are preserved under the deleted-user placeholder.</p>
                    <form action={deleteAccount} className="mt-4">
                        <button type="submit" className="rounded-full border border-red-500 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-500 hover:text-white">
                            Delete My Account
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
