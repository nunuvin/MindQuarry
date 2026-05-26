import { db } from "./db";
import { normalizeMessagingUsernameCandidate, type MessagingUsernameValidationResult } from "./messagingShared";

export type { MessagingUsernameValidationResult } from "./messagingShared";

export type ResolvedMessagingUser = {
    id: string;
    username: string;
    label: string;
};

export async function canMessageUser(viewerUserId: string, targetUserId: string) {
    const targetProfile = await db.selectFrom("profiles")
        .select("messaging_privacy")
        .where("user_id", "=", targetUserId)
        .executeTakeFirst();

    const privacy = targetProfile?.messaging_privacy || "anyone";

    if (privacy === "anyone") {
        return true;
    }

    const isMutual = !!(await db.selectFrom("follows as f1")
        .select("f1.following_id")
        .where("f1.follower_id", "=", viewerUserId)
        .where("f1.following_id", "=", targetUserId)
        .where("f1.is_mutual", "=", true)
        .executeTakeFirst());

    if (privacy === "mutuals") {
        return isMutual;
    }

    if (privacy === "quarry_members") {
        if (isMutual) {
            return true;
        }

        const sharesQuarry = !!(await db.selectFrom("quarry_members as qm1")
            .innerJoin("quarry_members as qm2", "qm1.quarry_id", "qm2.quarry_id")
            .select("qm1.quarry_id")
            .where("qm1.user_id", "=", viewerUserId)
            .where("qm2.user_id", "=", targetUserId)
            .executeTakeFirst());

        return sharesQuarry;
    }

    return true;
}

export async function validateMessagingUsername(options: {
    viewerUserId: string;
    rawUsername: string;
    blockedUsernames?: string[];
}) {
    const username = normalizeMessagingUsernameCandidate(options.rawUsername);
    const blockedUsernames = new Set((options.blockedUsernames || []).map((value) => value.toLowerCase()));

    if (!username) {
        return { ok: false, message: "Enter a username first." } satisfies MessagingUsernameValidationResult;
    }

    if (blockedUsernames.has(username.toLowerCase())) {
        return { ok: false, message: `${username} is already in the list.` } satisfies MessagingUsernameValidationResult;
    }

    const user = await db.selectFrom("user")
        .select(["id", "username", "displayUsername", "name"])
        .where("username", "=", username)
        .executeTakeFirst();

    if (!user?.id || !user.username) {
        return { ok: false, message: `Could not find @${username}.` } satisfies MessagingUsernameValidationResult;
    }

    if (user.id === options.viewerUserId) {
        return { ok: false, message: "You cannot add yourself to this chat." } satisfies MessagingUsernameValidationResult;
    }

    const isMessageable = await canMessageUser(options.viewerUserId, user.id);
    if (!isMessageable) {
        return { ok: false, message: `@${user.username} is not currently messageable.` } satisfies MessagingUsernameValidationResult;
    }

    return {
        ok: true,
        userId: user.id,
        username: user.username,
        label: user.displayUsername || user.username || user.name || user.id,
    } satisfies MessagingUsernameValidationResult;
}

export async function resolveValidMessagingUsers(options: {
    viewerUserId: string;
    usernames: string[];
    blockedUsernames?: string[];
}) {
    const uniqueUsernames = Array.from(new Set(
        options.usernames
            .map((value) => normalizeMessagingUsernameCandidate(value))
            .filter((value) => value.length > 0),
    ));

    const results = await Promise.all(uniqueUsernames.map((username) => validateMessagingUsername({
        viewerUserId: options.viewerUserId,
        rawUsername: username,
        blockedUsernames: options.blockedUsernames,
    })));

    return {
        users: results.filter((result): result is { ok: true; username: string; userId: string; label: string } => result.ok && !!result.username && !!result.userId && !!result.label)
            .map((result) => ({
                id: result.userId,
                username: result.username,
                label: result.label || result.username,
            })) satisfies ResolvedMessagingUser[],
        errors: results.filter((result) => !result.ok).map((result) => result.message || "Unable to validate that username."),
    };
}

export async function deleteConversationForParticipant(options: {
    conversationId: string;
    userId: string;
}) {
    return db.transaction().execute(async (trx) => {
        const membership = await trx.selectFrom("conversation_participants as cp")
            .innerJoin("conversations as c", "c.id", "cp.conversation_id")
            .select(["c.id", "c.is_group"])
            .where("cp.conversation_id", "=", options.conversationId)
            .where("cp.user_id", "=", options.userId)
            .executeTakeFirst();

        if (!membership?.id) {
            return { ok: false, message: "You are no longer part of this chat." };
        }

        await trx.deleteFrom("conversation_participants")
            .where("conversation_id", "=", options.conversationId)
            .where("user_id", "=", options.userId)
            .execute();

        const remaining = await trx.selectFrom("conversation_participants")
            .select(({ fn }) => fn.count<number>("user_id").as("count"))
            .where("conversation_id", "=", options.conversationId)
            .executeTakeFirst();

        const remainingCount = Number(remaining?.count ?? 0);
        if (remainingCount === 0) {
            await trx.deleteFrom("conversations")
                .where("id", "=", options.conversationId)
                .execute();
        } else {
            await trx.updateTable("conversations")
                .set({ updated_at: new Date() })
                .where("id", "=", options.conversationId)
                .execute();
        }

        return {
            ok: true,
            isGroup: Boolean(membership.is_group),
            conversationDeleted: remainingCount === 0,
        };
    });
}