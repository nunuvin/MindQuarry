import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUUID } from "@/lib/utils";
import { refreshProfileMetrics } from "@/lib/notifications";
import { canViewProfile, getProfileVisibility } from "@/lib/visibility";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    const resolvedParams = await params;

    const user = await db.selectFrom("user")
        .select(["id", "name", "image", "createdAt", "displayUsername", "username"])
        .where("username", "=", resolvedParams.username)
        .executeTakeFirst();

    if (!user) {
        return notFound();
    }

    let profile = await db.selectFrom("profiles").selectAll().where("user_id", "=", user.id).executeTakeFirst();
    if (!profile) {
        await db.insertInto("profiles").values({ user_id: user.id }).execute();
        profile = await db.selectFrom("profiles").selectAll().where("user_id", "=", user.id).executeTakeFirst();
    }

    const isMe = session?.user?.id === user.id;
    const profileUserId = user.id;
    const profileVisibility = getProfileVisibility(profile);
    const canView = canViewProfile(user.id, profileVisibility, session?.user?.id);

    if (!canView) {
        if (!session?.user && profileVisibility === "authenticated") {
            redirect("/login");
        }

        return (
            <div className="page-shell max-w-3xl">
                <div className="soft-panel p-12 text-center">
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-red-500">Profile Restricted</h1>
                    <p className="mt-4 text-muted-foreground">This profile is not public.</p>
                </div>
            </div>
        );
    }

    await refreshProfileMetrics(user.id);
    profile = await db.selectFrom("profiles").selectAll().where("user_id", "=", user.id).executeTakeFirst();

    const [followerCount, followingCount, bans, followStatus] = await Promise.all([
        db.selectFrom("follows")
            .select(({ fn }) => fn.count<number>("follows.follower_id").as("count"))
            .where("following_id", "=", user.id)
            .executeTakeFirst(),
        db.selectFrom("follows")
            .select(({ fn }) => fn.count<number>("follows.following_id").as("count"))
            .where("follower_id", "=", user.id)
            .executeTakeFirst(),
        db.selectFrom("bans_and_timeouts")
            .select(({ fn }) => fn.count<number>("bans_and_timeouts.id").as("count"))
            .where("user_id", "=", user.id)
            .where("status", "=", "active")
            .executeTakeFirst(),
        !session?.user || isMe
            ? Promise.resolve(null)
            : db.selectFrom("follows")
                .selectAll()
                .where("follower_id", "=", session.user.id)
                .where("following_id", "=", user.id)
                .executeTakeFirst(),
    ]);

    async function toggleFollow() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const current = await db.selectFrom("follows")
            .selectAll()
            .where("follower_id", "=", session.user.id)
            .where("following_id", "=", profileUserId)
            .executeTakeFirst();

        if (current) {
            await db.deleteFrom("follows")
                .where("follower_id", "=", session.user.id)
                .where("following_id", "=", profileUserId)
                .execute();
            await db.updateTable("follows")
                .set({ is_mutual: false })
                .where("follower_id", "=", profileUserId)
                .where("following_id", "=", session.user.id)
                .execute();
            return;
        }

        const inverse = await db.selectFrom("follows")
            .selectAll()
            .where("follower_id", "=", profileUserId)
            .where("following_id", "=", session.user.id)
            .executeTakeFirst();

        const isMutual = Boolean(inverse);
        await db.insertInto("follows").values({
            follower_id: session.user.id,
            following_id: profileUserId,
            is_mutual: isMutual,
        }).execute();

        if (isMutual) {
            await db.updateTable("follows")
                .set({ is_mutual: true })
                .where("follower_id", "=", profileUserId)
                .where("following_id", "=", session.user.id)
                .execute();
        }

        await db.insertInto("notifications").values({
            id: generateUUID(),
            user_id: profileUserId,
            type: "follow",
            source_id: session.user.id,
            actor_user_id: session.user.id,
            title: `${session.user.name || "Someone"} followed you`,
            body: `${session.user.name || "Someone"} started following your profile.`,
            href: `/users/${session.user.username || session.user.id}`,
        }).execute();
    }

    return (
        <div className="page-shell max-w-4xl">
            <div className="soft-panel flex flex-col gap-8 p-8 sm:p-10">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-muted">
                            {user.image ? (
                                <Image src={user.image} alt="avatar" width={96} height={96} className="h-24 w-24 object-cover" />
                            ) : (
                                <span className="text-4xl text-muted-foreground">👤</span>
                            )}
                        </div>
                        <div>
                            <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Profile</p>
                            <div className="mt-2 text-3xl font-semibold tracking-tight">{user.displayUsername || user.username || user.name}</div>
                            <div className="mt-2 text-sm font-semibold text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                            <div className="mt-3 inline-flex rounded-full border border-border/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {profileVisibility === "private" ? "Private" : profileVisibility === "authenticated" ? "Account Required" : "Public"}
                            </div>
                        </div>
                    </div>

                    {!isMe && (
                        session?.user ? (
                            <form action={toggleFollow}>
                                <button type="submit" className={followStatus ? "soft-button" : "soft-button-primary"}>
                                    {followStatus ? (followStatus.is_mutual ? "Mutual Follow" : "Unfollow") : "Follow"}
                                </button>
                            </form>
                        ) : (
                            <Link href="/login" className="soft-button-primary">Log in to follow</Link>
                        )
                    )}

                    {isMe && (
                        <div className="flex gap-3">
                            <Link href="/settings" className="soft-button">Edit Profile</Link>
                            <Link href="/settings/follows" className="soft-button">Follows</Link>
                        </div>
                    )}
                </div>

                {profile?.bio && (
                    <div className="rounded-[20px] border border-border/70 bg-muted/40 p-5 whitespace-pre-wrap font-medium leading-7">
                        {profile.bio}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-[20px] border border-border/70 bg-card p-5 text-center">
                        <span className="text-2xl font-semibold">{Number(profile?.reputation || 0)}</span>
                        <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reputation</span>
                    </div>
                    <div className="rounded-[20px] border border-border/70 bg-card p-5 text-center">
                        <span className="text-2xl font-semibold">{Number(profile?.questions_asked || 0)}</span>
                        <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Questions</span>
                    </div>
                    <div className="rounded-[20px] border border-border/70 bg-card p-5 text-center">
                        <span className="text-2xl font-semibold">{Number(profile?.replies_provided || 0)}</span>
                        <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Answers</span>
                    </div>
                    <div className="rounded-[20px] border border-green-500/30 bg-green-500/8 p-5 text-center">
                        <span className="text-2xl font-semibold text-green-600">{Number(profile?.replies_accepted || 0)}</span>
                        <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Accepted</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-6 border-t border-border/70 pt-6 text-sm font-semibold text-muted-foreground">
                    <div><span className="text-lg text-foreground">{Number(followerCount?.count || 0)}</span> Followers</div>
                    <div><span className="text-lg text-foreground">{Number(followingCount?.count || 0)}</span> Following</div>
                    {Number(bans?.count || 0) > 0 && (
                        <div className="ml-auto text-red-500"><span className="text-lg">{Number(bans?.count || 0)}</span> Active Bans</div>
                    )}
                </div>

                {isMe && (
                    <div className="rounded-[20px] border border-border/70 bg-card p-5 text-sm leading-7 text-muted-foreground">
                        Manage who can see your profile, which threads you follow, and whether mentions notify you from <Link href="/settings" className="font-semibold text-sky-600 hover:underline">settings</Link>.
                    </div>
                )}
            </div>
        </div>
    );
}
