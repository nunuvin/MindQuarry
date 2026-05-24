import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { unsubscribeUserFromQuery } from "@/lib/notifications";

export default async function FollowsPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const [users, threads] = await Promise.all([
        db.selectFrom("follows")
            .innerJoin("user", "user.id", "follows.following_id")
            .select([
                "follows.following_id",
                "follows.is_mutual",
                "user.username",
                "user.displayUsername",
                "user.name",
            ])
            .where("follows.follower_id", "=", session.user.id)
            .orderBy("user.displayUsername", "asc")
            .orderBy("user.username", "asc")
            .execute(),
        db.selectFrom("query_subscriptions")
            .innerJoin("queries", "queries.id", "query_subscriptions.query_id")
            .innerJoin("quarries", "quarries.id", "queries.quarry_id")
            .select([
                "query_subscriptions.query_id",
                "query_subscriptions.reason",
                "queries.title",
                "quarries.name as quarry_name",
            ])
            .where("query_subscriptions.user_id", "=", session.user.id)
            .orderBy("queries.created_at", "desc")
            .execute(),
    ]);

    async function unfollowUser(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const followingId = formData.get("following_id") as string;
        if (!followingId) return;

        await db.deleteFrom("follows")
            .where("follower_id", "=", session.user.id)
            .where("following_id", "=", followingId)
            .execute();

        await db.updateTable("follows")
            .set({ is_mutual: false })
            .where("follower_id", "=", followingId)
            .where("following_id", "=", session.user.id)
            .execute();

        revalidatePath("/settings/follows");
    }

    async function unfollowThread(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const queryId = formData.get("query_id") as string;
        if (!queryId) return;

        await unsubscribeUserFromQuery(queryId, session.user.id);
        revalidatePath("/settings/follows");
    }

    return (
        <div className="page-shell max-w-5xl">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
                <div>
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Follows</p>
                    <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Things You Follow</h1>
                </div>
                <div className="flex gap-3">
                    <Link href="/settings" className="soft-button">Back to Settings</Link>
                    <Link href="/notifications" className="soft-button">Notifications</Link>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="soft-panel p-6 sm:p-8">
                    <h2 className="font-display text-2xl font-semibold tracking-tight">People</h2>
                    <div className="mt-6 space-y-4">
                        {users.length === 0 && <p className="text-sm text-muted-foreground">You are not following anyone yet.</p>}
                        {users.map((user) => (
                            <div key={user.following_id} className="flex items-center justify-between gap-4 rounded-[20px] border border-border/70 bg-card p-4">
                                <div>
                                    <Link href={`/users/${encodeURIComponent(user.username || user.displayUsername || user.name || user.following_id)}`} className="font-semibold hover:text-sky-600">
                                        {user.displayUsername || user.username || user.name}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">{user.is_mutual ? "Mutual follow" : "Following"}</p>
                                </div>
                                <form action={unfollowUser}>
                                    <input type="hidden" name="following_id" value={user.following_id} />
                                    <button type="submit" className="soft-button">Unfollow</button>
                                </form>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="soft-panel p-6 sm:p-8">
                    <h2 className="font-display text-2xl font-semibold tracking-tight">Threads</h2>
                    <div className="mt-6 space-y-4">
                        {threads.length === 0 && <p className="text-sm text-muted-foreground">You are not following any threads yet.</p>}
                        {threads.map((thread) => (
                            <div key={thread.query_id} className="flex items-center justify-between gap-4 rounded-[20px] border border-border/70 bg-card p-4">
                                <div>
                                    <Link href={`/q/${thread.quarry_name}/query/${thread.query_id}`} className="font-semibold hover:text-sky-600">
                                        {thread.title}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">q/{thread.quarry_name} · {thread.reason}</p>
                                </div>
                                <form action={unfollowThread}>
                                    <input type="hidden" name="query_id" value={thread.query_id} />
                                    <button type="submit" className="soft-button">Unfollow</button>
                                </form>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
