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
import { validateMessagingUsername } from "@/lib/messaging";

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
        group_name: conv.group_name,
        participantLabel: conv.displayUsername || conv.username || conv.user_name || null,
    }));

    const conversationMap = new Map<string, {
        id: string;
        is_group: boolean | null;
        updated_at: Date | null;
        group_name: string | null;
        participantLabels: Set<string>;
    }>();

    for (const conversation of enrichedConversations) {
        const existing = conversationMap.get(conversation.id) || {
            id: conversation.id,
            is_group: conversation.is_group,
            updated_at: conversation.updated_at,
            group_name: conversation.group_name,
            participantLabels: new Set<string>(),
        };

        if (conversation.participantLabel) {
            existing.participantLabels.add(conversation.participantLabel);
        }

        conversationMap.set(conversation.id, existing);
    }

    const dedupedConversations = Array.from(conversationMap.values()).map((conversation) => ({
        id: conversation.id,
        is_group: conversation.is_group,
        updated_at: conversation.updated_at,
        displayName: conversation.is_group
            ? (conversation.group_name || Array.from(conversation.participantLabels).join(", ") || "Group Chat")
            : (Array.from(conversation.participantLabels)[0] || "Unknown User"),
        participantCount: conversation.is_group ? conversation.participantLabels.size + 1 : 2,
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

        const targetUser = await validateMessagingUsername({
            viewerUserId: session.user.id,
            rawUsername: targetUsername,
        });
        if (!targetUser.ok || !targetUser.userId) return;

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
                { conversation_id: convId, user_id: targetUser.userId, role: 'member' }
            ])
            .execute();

        redirect(`/messages/${convId}`);
    }

    return (
        <div className="page-shell max-w-7xl">
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

            <div className="grid gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
                <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                    <div className="soft-panel p-5 sm:p-6">
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

                <div className="space-y-4">
                    {dedupedConversations.map(conv => (
                        <Link href={`/messages/${conv.id}`} key={conv.id} className="soft-card flex flex-col p-5 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <h3 className="font-display truncate text-lg font-semibold tracking-tight sm:text-xl">{conv.displayName}</h3>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">{conv.is_group ? "Group" : "Direct"}</span>
                                        {conv.is_group && <span>{conv.participantCount} members</span>}
                                    </div>
                                </div>
                                <span className="shrink-0 text-xs font-bold text-muted-foreground">{conv.updated_at ? new Date(conv.updated_at).toLocaleDateString() : ''}</span>
                            </div>
                        </Link>
                    ))}

                    {dedupedConversations.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                            You have no messages yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
