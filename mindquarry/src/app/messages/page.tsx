import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { generateUUID } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { isRateLimited } from "@/lib/rateLimit";

export default async function MessagesPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const settings = await getSiteSettings();
    if (settings?.simplified_mode_enabled) {
        return (
            <div className="max-w-4xl mx-auto mt-12 p-12 text-center border-2 border-dashed border-black dark:border-white">
                <h1 className="text-2xl font-black uppercase mb-4">Messaging Disabled</h1>
                <p>Direct messaging is currently disabled by the administrator via Simplified Mode.</p>
            </div>
        );
    }

    const conversations = await db.selectFrom("conversation_participants")
        .innerJoin("conversations", "conversations.id", "conversation_participants.conversation_id")
        .select([
            "conversations.id", "conversations.is_group", "conversations.name", "conversations.updated_at"
        ])
        .where("conversation_participants.user_id", "=", session.user.id)
        .orderBy("conversations.updated_at", "desc")
        .execute();

    // Fetch details for 1-on-1 chats
    const enrichedConversations = await Promise.all(conversations.map(async (conv) => {
        if (!conv.is_group) {
            const otherUser = await db.selectFrom("conversation_participants")
                .innerJoin("user", "user.id", "conversation_participants.user_id")
                .select(["user.name", "user.displayUsername", "user.username"])
                .where("conversation_id", "=", conv.id)
                .where("user_id", "!=", session.user.id)
                .executeTakeFirst();

            return {
                ...conv,
                displayName: otherUser ? (otherUser.displayUsername || otherUser.username || otherUser.name) : "Unknown User"
            };
        }
        return {
            ...conv,
            displayName: conv.name || "Group Chat"
        };
    }));

    async function startNewChat(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        // Rate limit new chats: Max 3 new chats per minute
        if (isRateLimited(session.user.id, "new_chat", 3, 60000)) return;

        const targetUsername = formData.get("username") as string;
        if (!targetUsername) return;

        const targetUser = await db.selectFrom("user").select("id").where("username", "=", targetUsername).executeTakeFirst();
        if (!targetUser || targetUser.id === session.user.id) return; // In real app: show error

        // Check messaging privacy
        const targetProfile = await db.selectFrom("profiles").select("messaging_privacy").where("user_id", "=", targetUser.id).executeTakeFirst();
        const privacy = targetProfile?.messaging_privacy || 'anyone';

        // Mutual follow bypasses all
        const isMutual = await db.selectFrom("follows").select("is_mutual").where("follower_id", "=", session.user.id).where("following_id", "=", targetUser.id).executeTakeFirst();

        if (!isMutual?.is_mutual) {
            if (privacy === 'mutuals') {
                return; // Blocked: target requires mutual follow
            }
            if (privacy === 'quarry_members') {
                // Check if they share any quarry
                const sharedQuarry = await db.selectFrom("quarry_members as qm1")
                    .innerJoin("quarry_members as qm2", "qm1.quarry_id", "qm2.quarry_id")
                    .select("qm1.quarry_id")
                    .where("qm1.user_id", "=", session.user.id)
                    .where("qm2.user_id", "=", targetUser.id)
                    .executeTakeFirst();
                if (!sharedQuarry) return; // Blocked: no shared quarry
            }
        }

        const convId = generateUUID();

        await db.transaction().execute(async (trx) => {
            await trx.insertInto("conversations").values({
                id: convId,
                is_group: false,
                created_by_id: session.user.id
            }).execute();

            await trx.insertInto("conversation_participants").values([
                { conversation_id: convId, user_id: session.user.id, role: 'admin' },
                { conversation_id: convId, user_id: targetUser.id, role: 'member' }
            ]).execute();
        });

        redirect(`/messages/${convId}`);
    }

    return (
        <div className="max-w-4xl mx-auto mt-8 p-4">
            <div className="flex justify-between items-center mb-8 border-b-[3px] border-black dark:border-white pb-2">
                <h1 className="text-3xl font-black uppercase">Inbox</h1>
                <Link href="/messages/new" className="px-4 py-2 font-bold border-[3px] border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                    New Group Chat
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                    <div className="p-4 bg-muted/30 border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                        <h2 className="font-bold uppercase mb-4 text-sm">Start New Chat</h2>
                        <form action={startNewChat} className="space-y-4">
                            <input name="username" required placeholder="Exact Username..." className="w-full p-2 border-2 border-black dark:border-white bg-card outline-none text-sm" />
                            <button type="submit" className="w-full py-2 bg-black text-white dark:bg-white dark:text-black font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] cursor-pointer hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all text-sm uppercase">
                                Message
                            </button>
                        </form>
                    </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                    {enrichedConversations.map(conv => (
                        <Link href={`/messages/${conv.id}`} key={conv.id} className="block p-4 border-[3px] border-black dark:border-white bg-card shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none transition-all flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg">{conv.displayName}</h3>
                                {conv.is_group && <span className="text-xs uppercase bg-black text-white dark:bg-white dark:text-black px-1 font-bold">Group</span>}
                            </div>
                            <span className="text-xs text-muted-foreground font-bold">{conv.updated_at ? new Date(conv.updated_at).toLocaleDateString() : ''}</span>
                        </Link>
                    ))}

                    {enrichedConversations.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                            You have no messages yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
