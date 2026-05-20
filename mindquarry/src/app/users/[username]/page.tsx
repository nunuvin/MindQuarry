
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateUUID } from "@/lib/utils";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) {
        redirect("/login");
    }

    const resolvedParams = await params;

    // Fetch user by username from the database
    const user = await db.selectFrom("user")
        .select(["id", "name", "image", "createdAt", "displayUsername", "username"])
        .where("username", "=", resolvedParams.username)
        .executeTakeFirst();

    if (!user) return notFound();

    const isMe = session.user.id === user.id;

    // Use json_build_object to reduce table scans and prevent Promise.all connection pool exhaustion.
    // Combine all metrics into a single round-trip using JSON building or single row aggregation subqueries
    // as required by the 5-Step Code Review Protocol.
    const { sql } = await import("kysely");

    // We can do this cleanly via subqueries mapped to aliases in one parent select, which executes as 1 network request.
    const combinedStats = await db.selectNoFrom((eb) => [
        sql<unknown>`(SELECT row_to_json(p) FROM mq_public.profiles p WHERE p.user_id = ${user.id})`.as("profile"),

        eb.selectFrom("queries").select(eb.fn.count("id").as("c")).where("user_id", "=", user.id).as("queryCount"),
        eb.selectFrom("queries").select(eb.fn.sum("score").as("s")).where("user_id", "=", user.id).as("queryScore"),
        eb.selectFrom("queries").select(eb.fn.count("id").as("c")).innerJoin("answers", "answers.id", "queries.accepted_answer_id").where("answers.user_id", "=", user.id).as("acceptedCount"),

        eb.selectFrom("answers").select(eb.fn.count("id").as("c")).where("user_id", "=", user.id).as("answerCount"),
        eb.selectFrom("answers").select(eb.fn.sum("score").as("s")).where("user_id", "=", user.id).as("answerScore"),

        eb.selectFrom("bans_and_timeouts").select(eb.fn.count("id").as("c")).where("user_id", "=", user.id).where("status", "=", "active").as("activeBansCount"),

        eb.selectFrom("follows").select(eb.fn.count("follower_id").as("c")).where("following_id", "=", user.id).as("followerCount"),
        eb.selectFrom("follows").select(eb.fn.count("following_id").as("c")).where("follower_id", "=", user.id).as("followingCount"),

        isMe ? sql<null>`null`.as("followStatus") : sql<unknown>`(SELECT row_to_json(f) FROM mq_public.follows f WHERE f.follower_id = ${session.user.id} AND f.following_id = ${user.id})`.as("followStatus")
    ]).executeTakeFirst();

    const queryCount = { count: Number(combinedStats?.queryCount || 0) };
    const answerCount = { count: Number(combinedStats?.answerCount || 0) };
    const acceptedCount = { count: Number(combinedStats?.acceptedCount || 0) };
    const queryScore = { sum: Number(combinedStats?.queryScore || 0) };
    const answerScore = { sum: Number(combinedStats?.answerScore || 0) };
    const bans = { count: Number(combinedStats?.activeBansCount || 0) };
    const followerCount = { count: Number(combinedStats?.followerCount || 0) };
    const followingCount = { count: Number(combinedStats?.followingCount || 0) };
    const followStatus = combinedStats?.followStatus as { is_mutual: boolean } | null;
    const profile = combinedStats?.profile as { bio?: string | null } | undefined;

    const reputation = (Number(queryScore?.sum || 0) + Number(answerScore?.sum || 0));

    async function toggleFollow() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !user) return;

        const current = await db.selectFrom("follows").selectAll().where("follower_id", "=", session.user.id).where("following_id", "=", user.id).executeTakeFirst();
        if (current) {
            await db.deleteFrom("follows").where("follower_id", "=", session.user.id).where("following_id", "=", user.id).execute();
            // Demutualize inverse if it existed
            await db.updateTable("follows").set({ is_mutual: false }).where("follower_id", "=", user.id).where("following_id", "=", session.user.id).execute();
        } else {
            const inverse = await db.selectFrom("follows").selectAll().where("follower_id", "=", user.id).where("following_id", "=", session.user.id).executeTakeFirst();
            const isMutual = !!inverse;
            await db.insertInto("follows").values({ follower_id: session.user.id, following_id: user.id, is_mutual: isMutual }).execute();
            if (isMutual) {
                await db.updateTable("follows").set({ is_mutual: true }).where("follower_id", "=", user.id).where("following_id", "=", session.user.id).execute();
            } else {
                await db.insertInto("notifications").values({
                    id: generateUUID(),
                    user_id: user.id,
                    type: "follow_request",
                    source_id: session.user.id,
                }).execute();
            }
        }
    }

    return (
        <div className="max-w-2xl mx-auto mt-12 p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff] flex flex-col gap-6">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-6">
                    <div className="h-24 w-24 rounded-none bg-muted flex items-center justify-center border-[3px] border-black dark:border-white overflow-hidden shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                        {user.image ? (
                            <Image src={user.image} alt="avatar" width={96} height={96} className="object-cover h-24 w-24" />
                        ) : (
                            <span className="text-4xl text-muted-foreground">👤</span>
                        )}
                    </div>
                    <div>
                        <div className="text-3xl font-black uppercase tracking-tight">{user.displayUsername || user.username || user.name}</div>
                        <div className="text-muted-foreground text-sm mt-1 font-bold">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>

                {!isMe && (
                    <form action={toggleFollow}>
                        <button type="submit" className={`px-6 py-2 font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer transition-colors ${followStatus ? 'bg-muted text-foreground' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                            {followStatus ? (followStatus.is_mutual ? "Mutual Follow" : "Unfollow") : "Follow"}
                        </button>
                    </form>
                )}

                {isMe && (
                    <a href="/settings" className="px-6 py-2 font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors text-sm">
                        Edit Profile
                    </a>
                )}
            </div>

            {profile?.bio && (
                <div className="p-4 bg-muted/30 border-l-4 border-black dark:border-white whitespace-pre-wrap font-medium">
                    {profile.bio}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 border-2 border-black dark:border-white">
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-black">{reputation}</span>
                    <span className="text-muted-foreground text-xs uppercase font-bold text-center">Reputation</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-black">{Number(queryCount?.count || 0)}</span>
                    <span className="text-muted-foreground text-xs uppercase font-bold text-center">Questions</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-black">{Number(answerCount?.count || 0)}</span>
                    <span className="text-muted-foreground text-xs uppercase font-bold text-center">Answers</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-green-500">{Number(acceptedCount?.count || 0)}</span>
                    <span className="text-green-500 text-xs uppercase font-bold text-center">Accepted</span>
                </div>
            </div>

            <div className="flex gap-8 text-sm font-bold border-b-2 border-black/10 dark:border-white/10 pb-4">
                <div><span className="text-lg">{Number(followerCount?.count || 0)}</span> Followers</div>
                <div><span className="text-lg">{Number(followingCount?.count || 0)}</span> Following</div>
                {Number(bans?.count || 0) > 0 && (
                    <div className="text-red-500 ml-auto"><span className="text-lg">{Number(bans?.count || 0)}</span> Active Bans</div>
                )}
            </div>

            {/* Extended history (e.g. recent questions/answers) would go here */}

        </div>
    );
}

