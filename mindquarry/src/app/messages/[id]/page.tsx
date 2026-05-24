import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { generateUUID } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { isRateLimited } from "@/lib/rateLimit";
import { ChatClient } from "./ChatClient";
import { hasRichTextContent } from "@/lib/utils";

type SendMessageResult = {
    ok: boolean;
    error?: string;
};

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

    const otherParticipants = await db.selectFrom("conversation_participants")
        .select(["user_id", "last_read_at"])
        .where("conversation_id", "=", resolvedParams.id)
        .where("user_id", "!=", session.user.id)
        .execute();

    async function sendMessage(formData: FormData): Promise<SendMessageResult> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, error: "You must be signed in to message." };
        }

        const participant = await db.selectFrom("conversation_participants")
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst();

        if (!participant) {
            return { ok: false, error: "You are no longer part of this conversation." };
        }

        // Rate limit: 20 messages per minute
        if (isRateLimited(session.user.id, "send_message", 20, 60000)) {
            return { ok: false, error: "You are sending messages too quickly. Please wait a moment." };
        }

        const body = formData.get("body") as string;
        if (!hasRichTextContent(body)) {
            return { ok: false, error: "Message cannot be empty." };
        }

        try {
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
            return { ok: true };
        } catch (error) {
            console.error("Failed to send message", error);
            return { ok: false, error: "Failed to send message." };
        }
    }

    return (
        <ChatClient
            conversationId={resolvedParams.id}
            displayName={displayName}
            messages={messages}
            userId={session.user.id}
            sendMessageAction={sendMessage}
            otherParticipants={otherParticipants}
        />
    );
}
