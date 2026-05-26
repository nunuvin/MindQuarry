import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { generateUUID } from "@/lib/utils";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";
import { resolveValidMessagingUsers, validateMessagingUsername } from "@/lib/messaging";
import NewGroupChatComposer from "./NewGroupChatComposer";

export default async function NewGroupChatPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const settings = await getSiteSettings();
    if (settings?.simplified_mode_enabled) {
        redirect("/messages");
    }

    const followedUsernames = await db.selectFrom("follows")
        .innerJoin("user", "user.id", "follows.following_id")
        .select("user.username")
        .where("follows.follower_id", "=", session.user.id)
        .orderBy("user.username", "asc")
        .execute();

    async function validateParticipantUsername(username: string) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, message: "You must be signed in to add people." };
        }

        return validateMessagingUsername({
            viewerUserId: session.user.id,
            rawUsername: username,
        });
    }

    async function createGroup(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, error: "You must be signed in to create a group." };
        }

        if (isRateLimited(session.user.id, "new_group_chat", MindQuarryConfig.MESSAGING.MAX_NEW_CHATS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            return { ok: false, error: "You are creating chats too quickly. Try again in a moment." };
        }

        const name = ((formData.get("name") as string) || "").trim();
        if (!name) {
            return { ok: false, error: "A group name is required." };
        }

        const requestedParticipants = formData.getAll("participants").map((value) => String(value));
        const { users, errors } = await resolveValidMessagingUsers({
            viewerUserId: session.user.id,
            usernames: requestedParticipants,
        });

        if (errors.length > 0) {
            return { ok: false, error: errors[0] };
        }

        if (users.length === 0) {
            return { ok: false, error: "Add at least one other user before creating the group." };
        }

        const convId = generateUUID();

        await db.transaction().execute(async (trx) => {
            await trx.insertInto("conversations").values({
                id: convId,
                is_group: true,
                name,
                created_by_id: session.user.id
            }).execute();

            await trx.insertInto("conversation_participants").values([
                {
                    conversation_id: convId,
                    user_id: session.user.id,
                    role: "admin",
                },
                ...users.map((user) => ({
                    conversation_id: convId,
                    user_id: user.id!,
                    role: "member",
                })),
            ]).execute();
        });

        return { ok: true, conversationId: convId };
    }

    return (
        <NewGroupChatComposer
            suggestedUsernames={followedUsernames.map((row) => row.username).filter((username): username is string => Boolean(username))}
            createGroupAction={createGroup}
            validateParticipantUsernameAction={validateParticipantUsername}
        />
    );
}
