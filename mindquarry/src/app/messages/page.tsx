import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { generateUUID } from "@/lib/utils";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";
import { Input } from "@/components/ui/input";
import { MessageSquarePlus, Users } from "lucide-react";

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

    const rawConversations = await db.selectFrom("conversation_participants as cp")
        .innerJoin("conversations as c", "c.id", "cp.conversation_id")
        .leftJoin("conversation_participants as sibling", (join) => join
            .onRef("sibling.conversation_id", "=", "c.id")
            .on("sibling.user_id", "!=", session.user.id)
        )
        .leftJoin("user as u", "u.id", "sibling.user_id")
        .select([
            "c.id",
            "c.is_group",
            "c.name as group_name",
            "c.updated_at",
            "u.name as user_name",
            "u.displayUsername",
            "u.username"
        ])
        .where("cp.user_id", "=", session.user.id)
        .orderBy("c.updated_at", "desc")
        .execute();

    const enrichedConversations = rawConversations.map(conv => ({
        id: conv.id,
        is_group: conv.is_group,
        updated_at: conv.updated_at,
        displayName: conv.is_group ? (conv.group_name || "Group Chat") : (conv.displayUsername || conv.username || conv.user_name || "Unknown User")
    }));

    async function startNewChat(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        // Rate limit new chats
        if (isRateLimited(session.user.id, "new_chat", MindQuarryConfig.MESSAGING.MAX_NEW_CHATS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const targetUsername = formData.get("username") as string;
        if (!targetUsername) return;

        const targetUser = await db.selectFrom("user").select("id").where("username", "=", targetUsername).executeTakeFirst();
        if (!targetUser || targetUser.id === session.user.id) return; // In real app: show error

        // Check messaging privacy
        const targetProfile = await db.selectFrom("profiles").select("messaging_privacy").where("user_id", "=", targetUser.id).executeTakeFirst();
        const privacy = targetProfile?.messaging_privacy || 'anyone';

        // 1. Fetch all privacy data primitives concurrently
        const isMutualResult = await db.selectFrom("follows as f1")
            .selectAll()
            .where("f1.follower_id", "=", session.user.id)
            .where("f1.following_id", "=", targetUser.id)
            .where("f1.is_mutual", "=", true)
            .executeTakeFirst();

        const sharesQuarryResult = await db.selectFrom("quarry_members as qm1")
            .innerJoin("quarry_members as qm2", "qm1.quarry_id", "qm2.quarry_id")
            .select("qm1.quarry_id")
            .where("qm1.user_id", "=", session.user.id)
            .where("qm2.user_id", "=", targetUser.id)
            .executeTakeFirst();

        const isMutual = !!isMutualResult;
        const sharesQuarry = !!sharesQuarryResult;

        if (!isMutual) {
            if (privacy === 'mutuals') {
                return; // Blocked safely
            }
            if (privacy === 'quarry_members' && !sharesQuarry) {
                return; // Blocked safely
            }
        }

        const convId = generateUUID();

        // Executed as a single network round-trip via CTE
        await db.with("new_conv", (db) => db
            .insertInto("conversations")
            .values({
                id: convId,
                is_group: false,
                created_by_id: session.user.id
            })
            .returning("id")
        )
            .insertInto("conversation_participants")
            .values([
                { conversation_id: convId, user_id: session.user.id, role: 'admin' },
                { conversation_id: convId, user_id: targetUser.id, role: 'member' }
            ])
            .execute();

        redirect(`/messages/${convId}`);
    }

    return (
        <div className="page-shell">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">Messages</p>
                    <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Inbox</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Open direct conversations, check read state, and jump back into group planning without the heavy page chrome.</p>
                </div>
                <Link href="/messages/new" className="soft-button">
                    <Users className="mr-2 h-4 w-4" />
                    New Group Chat
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                    <div className="soft-panel p-5">
                        <h2 className="font-display mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Start New Chat</h2>
                        <form action={startNewChat} className="space-y-4">
                            <div className="relative flex items-center overflow-hidden rounded-full border border-border/70 bg-card/85 shadow-sm transition duration-200 focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]">
                                <MessageSquarePlus className="absolute left-4 h-4 w-4 text-muted-foreground" />
                                <div className="absolute left-10 h-5 w-px bg-border/80" />
                                <Input name="username" required placeholder="Who do you want to chat with?" className="h-12 border-0 bg-transparent pl-14 pr-4 text-sm shadow-none focus-visible:ring-0" />
                            </div>
                            <p className="text-sm text-muted-foreground">Use an exact username to open a direct conversation.</p>
                            <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">
                                Open Conversation
                            </button>
                        </form>
                    </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                    {enrichedConversations.map(conv => (
                        <Link href={`/messages/${conv.id}`} key={conv.id} className="soft-card block p-5 flex justify-between items-center gap-4">
                            <div>
                                <h3 className="font-display text-lg font-semibold tracking-tight">{conv.displayName}</h3>
                                {conv.is_group && <span className="mt-2 inline-flex rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Group</span>}
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
