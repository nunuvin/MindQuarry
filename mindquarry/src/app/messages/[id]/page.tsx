import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { generateUUID } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { isRateLimited } from "@/lib/rateLimit";
import { ChatClient } from "./ChatClient";
import { hasRichTextContent } from "@/lib/utils";
import { MindQuarryConfig } from "@/lib/config";
import { deleteMessageBySender, hideMessage } from "@/lib/content";
import { isGlobalAdmin } from "@/lib/admin";
import { normalizeMentionContent } from "@/lib/mentions";
import { deleteConversationForParticipant, resolveValidMessagingUsers, validateMessagingUsername } from "@/lib/messaging";

type SendMessageResult = {
    ok: boolean;
    error?: string;
};

type DeleteMessageResult = {
    ok: boolean;
    error?: string;
};

type HideMessageResult = {
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
    const isAdmin = await isGlobalAdmin(session.user.id);

    const participant = await db.selectFrom("conversation_participants")
        .select("role")
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
            "messages.id", "messages.body", "messages.created_at", "messages.sender_id", "messages.is_hidden",
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

    const participants = (await db.selectFrom("conversation_participants")
        .innerJoin("user", "user.id", "conversation_participants.user_id")
        .select([
            "conversation_participants.user_id",
            "conversation_participants.role",
            "conversation_participants.last_read_at",
            "user.name",
            "user.displayUsername",
            "user.username",
        ])
        .where("conversation_participants.conversation_id", "=", resolvedParams.id)
        .execute())
        .sort((left, right) => {
            if (left.role === right.role) {
                return (left.displayUsername || left.username || left.name || "").localeCompare(right.displayUsername || right.username || right.name || "");
            }

            return left.role === "admin" ? -1 : 1;
        });

    const followedUsernames = conversation.is_group
        ? await db.selectFrom("follows")
            .innerJoin("user", "user.id", "follows.following_id")
            .select("user.username")
            .where("follows.follower_id", "=", session.user.id)
            .orderBy("user.username", "asc")
            .execute()
        : [];

    const canManageGroup = Boolean(conversation.is_group && (participant.role === "admin" || conversation.created_by_id === session.user.id));

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

        if (isRateLimited(session.user.id, "send_message", MindQuarryConfig.MESSAGING.MAX_MESSAGES_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            return { ok: false, error: "You are sending messages too quickly. Please wait a moment." };
        }

        const body = formData.get("body") as string;
        if (!hasRichTextContent(body)) {
            return { ok: false, error: "Message cannot be empty." };
        }

        const normalizedBody = (await normalizeMentionContent(body, session.user.id)).content;

        try {
            await db.transaction().execute(async (trx) => {
                await trx.insertInto("messages").values({
                    id: generateUUID(),
                    conversation_id: resolvedParams.id,
                    sender_id: session.user.id,
                    body: normalizedBody,
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

    async function deleteMessage(formData: FormData): Promise<DeleteMessageResult> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, error: "You must be signed in to delete messages." };
        }

        const messageId = formData.get("message_id") as string;
        if (!messageId) {
            return { ok: false, error: "Missing message." };
        }

        if (isRateLimited(session.user.id, "delete_message", MindQuarryConfig.MESSAGING.MAX_MESSAGE_DELETES_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            return { ok: false, error: "You are deleting messages too quickly. Please wait a moment." };
        }

        const conversationId = await deleteMessageBySender({
            messageId,
            userId: session.user.id,
            allowModeratorDelete: isAdmin,
        });

        if (!conversationId) {
            return { ok: false, error: "Unable to delete that message." };
        }

        revalidatePath(`/messages/${conversationId}`);
        revalidatePath("/messages");
        return { ok: true };
    }

    async function moderateHideMessage(formData: FormData): Promise<HideMessageResult> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !(await isGlobalAdmin(session.user.id))) {
            return { ok: false, error: "Only global admins can hide messages." };
        }

        const messageId = formData.get("message_id") as string;
        if (!messageId) {
            return { ok: false, error: "Missing message." };
        }

        const conversationId = await hideMessage({
            messageId,
            actorUserId: session.user.id,
        });

        if (!conversationId) {
            return { ok: false, error: "Unable to hide that message." };
        }

        revalidatePath(`/messages/${conversationId}`);
        return { ok: true };
    }

    async function deleteConversation(): Promise<{ ok: boolean; error?: string; redirectTo?: string }> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, error: "You must be signed in to delete chats." };
        }

        const result = await deleteConversationForParticipant({
            conversationId: resolvedParams.id,
            userId: session.user.id,
        });

        if (!result.ok) {
            return { ok: false, error: result.message || "Unable to delete that chat." };
        }

        revalidatePath("/messages");
        revalidatePath(`/messages/${resolvedParams.id}`);
        return { ok: true, redirectTo: "/messages" };
    }

    async function validateParticipantUsername(username: string) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, message: "You must be signed in to add people." };
        }

        const membership = await db.selectFrom("conversation_participants")
            .select("role")
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst();

        const conversationRow = await db.selectFrom("conversations")
            .select(["is_group", "created_by_id"])
            .where("id", "=", resolvedParams.id)
            .executeTakeFirst();

        if (!membership || !conversationRow?.is_group || !(membership.role === "admin" || conversationRow.created_by_id === session.user.id)) {
            return { ok: false, message: "Only group admins can add people." };
        }

        return validateMessagingUsername({
            viewerUserId: session.user.id,
            rawUsername: username,
        });
    }

    async function renameConversation(formData: FormData): Promise<{ ok: boolean; error?: string }> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, error: "You must be signed in to rename this chat." };
        }

        const membership = await db.selectFrom("conversation_participants")
            .select("role")
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst();

        if (!conversation?.is_group || !membership || !(membership.role === "admin" || conversation.created_by_id === session.user.id)) {
            return { ok: false, error: "Only group admins can rename this chat." };
        }

        const nextName = ((formData.get("name") as string) || "").trim();
        if (!nextName) {
            return { ok: false, error: "A group name is required." };
        }

        await db.updateTable("conversations")
            .set({
                name: nextName,
                updated_at: new Date(),
            })
            .where("id", "=", resolvedParams.id)
            .execute();

        revalidatePath(`/messages/${resolvedParams.id}`);
        revalidatePath("/messages");
        return { ok: true };
    }

    async function addParticipants(formData: FormData): Promise<{ ok: boolean; error?: string }> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, error: "You must be signed in to add people." };
        }

        const membership = await db.selectFrom("conversation_participants")
            .select("role")
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst();

        if (!conversation?.is_group || !membership || !(membership.role === "admin" || conversation.created_by_id === session.user.id)) {
            return { ok: false, error: "Only group admins can add people." };
        }

        const requestedUsernames = formData.getAll("participants").map((value) => String(value));
        const currentUsernames = participants.map((row) => row.username).filter((username): username is string => Boolean(username));
        const { users, errors } = await resolveValidMessagingUsers({
            viewerUserId: session.user.id,
            usernames: requestedUsernames,
            blockedUsernames: currentUsernames,
        });

        if (errors.length > 0) {
            return { ok: false, error: errors[0] };
        }

        if (users.length === 0) {
            return { ok: false, error: "Add at least one new person to the list first." };
        }

        await db.insertInto("conversation_participants")
            .values(users.map((user) => ({
                conversation_id: resolvedParams.id,
                user_id: user.id!,
                role: "member",
            })))
            .execute();

        await db.updateTable("conversations")
            .set({ updated_at: new Date() })
            .where("id", "=", resolvedParams.id)
            .execute();

        revalidatePath(`/messages/${resolvedParams.id}`);
        revalidatePath("/messages");
        return { ok: true };
    }

    async function removeParticipant(formData: FormData): Promise<{ ok: boolean; error?: string; removedSelf?: boolean; redirectTo?: string }> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, error: "You must be signed in to remove people." };
        }

        const targetUserId = formData.get("user_id") as string;
        if (!targetUserId) {
            return { ok: false, error: "Missing participant." };
        }

        const membership = await db.selectFrom("conversation_participants")
            .select("role")
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst();

        if (!membership) {
            return { ok: false, error: "You are no longer part of this conversation." };
        }

        if (targetUserId === session.user.id) {
            const result = await deleteConversationForParticipant({
                conversationId: resolvedParams.id,
                userId: session.user.id,
            });

            if (!result.ok) {
                return { ok: false, error: result.message || "Unable to leave this group." };
            }

            revalidatePath(`/messages/${resolvedParams.id}`);
            revalidatePath("/messages");
            return { ok: true, removedSelf: true, redirectTo: "/messages" };
        }

        if (!conversation?.is_group || !(membership.role === "admin" || conversation.created_by_id === session.user.id)) {
            return { ok: false, error: "Only group admins can remove other people." };
        }

        await db.deleteFrom("conversation_participants")
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "=", targetUserId)
            .execute();

        await db.updateTable("conversations")
            .set({ updated_at: new Date() })
            .where("id", "=", resolvedParams.id)
            .execute();

        revalidatePath(`/messages/${resolvedParams.id}`);
        revalidatePath("/messages");
        return { ok: true };
    }

    return (
        <ChatClient
            conversationId={resolvedParams.id}
            displayName={displayName}
            messages={messages}
            userId={session.user.id}
            isGlobalAdmin={isAdmin}
            sendMessageAction={sendMessage}
            deleteMessageAction={deleteMessage}
            hideMessageAction={moderateHideMessage}
            otherParticipants={otherParticipants}
            conversationMeta={{
                isGroup: Boolean(conversation.is_group),
                name: conversation.name,
                canManageParticipants: canManageGroup,
                participants,
                followedUsernames: followedUsernames.map((row) => row.username).filter((username): username is string => Boolean(username)),
            }}
            deleteConversationAction={deleteConversation}
            validateParticipantUsernameAction={validateParticipantUsername}
            renameConversationAction={renameConversation}
            addParticipantsAction={addParticipants}
            removeParticipantAction={removeParticipant}
        />
    );
}
