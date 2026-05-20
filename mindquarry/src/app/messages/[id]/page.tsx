import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { generateUUID } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { isRateLimited } from "@/lib/rateLimit";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const resolvedParams = await params;

    const participant = await db.selectFrom("conversation_participants")
        .where("conversation_id", "=", resolvedParams.id)
        .where("user_id", "=", session.user.id)
        .executeTakeFirst();

    if (!participant) return notFound();

    const conversation = await db.selectFrom("conversations").selectAll().where("id", "=", resolvedParams.id).executeTakeFirst();
    if (!conversation) return notFound();

    let displayName = conversation.name || "Group Chat";

    if (!conversation.is_group) {
        const otherUser = await db.selectFrom("conversation_participants")
            .innerJoin("user", "user.id", "conversation_participants.user_id")
            .select(["user.name", "user.displayUsername", "user.username"])
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "!=", session.user.id)
            .executeTakeFirst();

        if (otherUser) {
            displayName = otherUser.displayUsername || otherUser.username || otherUser.name || "Unknown User";
        }
    }

    const messages = await db.selectFrom("messages")
        .leftJoin("user", "user.id", "messages.sender_id")
        .select([
            "messages.id", "messages.body", "messages.created_at", "messages.sender_id",
            "user.name", "user.displayUsername", "user.username"
        ])
        .where("conversation_id", "=", resolvedParams.id)
        .orderBy("messages.created_at", "asc")
        .execute();

    async function sendMessage(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const participant = await db.selectFrom("conversation_participants")
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst();

        if (!participant) return;

        // Rate limit: 20 messages per minute
        if (isRateLimited(session.user.id, "send_message", 20, 60000)) return;

        const body = formData.get("body") as string;
        if (!body) return;

        await db.transaction().execute(async (trx) => {
            await trx.insertInto("messages").values({
                id: generateUUID(),
                conversation_id: resolvedParams.id,
                sender_id: session.user.id,
                body
            }).execute();

            await trx.updateTable("conversations").set({ updated_at: new Date() }).where("id", "=", resolvedParams.id).execute();
        });

        revalidatePath(`/messages/${resolvedParams.id}`);
    }

    return (
        <div className="max-w-3xl mx-auto mt-4 p-4 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex items-center gap-4 mb-4">
                <Link href="/messages" className="font-bold border-[3px] border-black dark:border-white w-10 h-10 flex items-center justify-center hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]">
                    &larr;
                </Link>
                <h1 className="text-2xl font-black uppercase flex-1 truncate">{displayName}</h1>
            </div>

            <div className="flex-1 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff] flex flex-col overflow-hidden relative">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
                    {messages.map(msg => {
                        const isMe = msg.sender_id === session.user.id;
                        return (
                            <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                <span className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">
                                    {isMe ? 'You' : (msg.displayUsername || msg.username || msg.name)}
                                </span>
                                <div className={`p-3 border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] whitespace-pre-wrap text-sm font-medium ${isMe ? 'bg-blue-100 dark:bg-blue-900' : 'bg-muted/50'}`}>
                                    {msg.body}
                                </div>
                            </div>
                        );
                    })}

                    {messages.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground font-bold">
                            Send a message to start the conversation.
                        </div>
                    )}
                </div>

                <div className="p-4 border-t-[3px] border-black dark:border-white bg-muted/20">
                    <form action={sendMessage} className="flex gap-4">
                        <input name="body" required autoComplete="off" placeholder="Type a message..." className="flex-1 p-3 border-2 border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm" />
                        <button type="submit" className="px-8 bg-blue-500 text-white font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:bg-blue-600 transition-colors">
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
