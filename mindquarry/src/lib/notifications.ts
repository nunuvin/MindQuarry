import { sql } from "kysely";

import { db } from "./db";
import { generateUUID, getRichTextPreview, richTextToPlainText } from "./utils";

const mentionPattern = /(^|[\s(])@([a-zA-Z0-9_]+)/g;

type NotificationInsert = {
    userId: string;
    type: string;
    actorUserId?: string | null;
    sourceId?: string | null;
    title: string;
    body?: string | null;
    href?: string | null;
    queryId?: string | null;
    answerId?: string | null;
};

export function extractMentionedUsernames(content: string) {
    const plainText = richTextToPlainText(content);
    const usernames = new Set<string>();

    for (const match of plainText.matchAll(mentionPattern)) {
        const username = match[2]?.trim().toLowerCase();

        if (username) {
            usernames.add(username);
        }
    }

    return Array.from(usernames);
}

async function insertNotifications(notifications: NotificationInsert[]) {
    if (notifications.length === 0) {
        return;
    }

    await db.insertInto("notifications").values(
        notifications.map((notification) => ({
            id: generateUUID(),
            user_id: notification.userId,
            type: notification.type,
            source_id: notification.sourceId ?? null,
            actor_user_id: notification.actorUserId ?? null,
            title: notification.title,
            body: notification.body ?? null,
            href: notification.href ?? null,
            query_id: notification.queryId ?? null,
            answer_id: notification.answerId ?? null,
        }))
    ).execute();
}

export async function subscribeUserToQuery(queryId: string, userId: string, reason: "author" | "answer" | "manual" = "manual") {
    await db.insertInto("query_subscriptions")
        .values({
            query_id: queryId,
            user_id: userId,
            reason,
        })
        .onConflict((oc) => oc.columns(["query_id", "user_id"]).doNothing())
        .execute();
}

export async function unsubscribeUserFromQuery(queryId: string, userId: string) {
    await db.deleteFrom("query_subscriptions")
        .where("query_id", "=", queryId)
        .where("user_id", "=", userId)
        .execute();
}

export async function getUnreadNotificationCount(userId: string) {
    const result = await db.selectFrom("notifications")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("user_id", "=", userId)
        .where("is_read", "=", false)
        .executeTakeFirst();

    return Number(result?.count ?? 0);
}

export async function markAllNotificationsRead(userId: string) {
    await db.updateTable("notifications")
        .set({ is_read: true })
        .where("user_id", "=", userId)
        .where("is_read", "=", false)
        .execute();
}

async function getInteractedUserIds(queryId: string) {
    const [queryAuthor, answerAuthors, subscribers] = await Promise.all([
        db.selectFrom("queries").select("user_id").where("id", "=", queryId).executeTakeFirst(),
        db.selectFrom("answers").select("user_id").where("query_id", "=", queryId).execute(),
        db.selectFrom("query_subscriptions").select("user_id").where("query_id", "=", queryId).execute(),
    ]);

    const userIds = new Set<string>();

    if (queryAuthor?.user_id) {
        userIds.add(queryAuthor.user_id);
    }

    answerAuthors.forEach((answer) => {
        if (answer.user_id) {
            userIds.add(answer.user_id);
        }
    });

    subscribers.forEach((subscription) => {
        if (subscription.user_id) {
            userIds.add(subscription.user_id);
        }
    });

    return userIds;
}

export async function notifyQuerySubscribers({
    queryId,
    actorUserId,
    href,
    title,
    body,
    answerId,
    explicitRecipientIds = [],
}: {
    queryId: string;
    actorUserId: string;
    href: string;
    title: string;
    body: string;
    answerId?: string;
    explicitRecipientIds?: string[];
}) {
    const subscriptions = await db.selectFrom("query_subscriptions")
        .select("user_id")
        .where("query_id", "=", queryId)
        .execute();

    const recipientIds = new Set<string>(explicitRecipientIds);

    subscriptions.forEach((subscription) => {
        if (subscription.user_id) {
            recipientIds.add(subscription.user_id);
        }
    });

    recipientIds.delete(actorUserId);

    await insertNotifications(
        Array.from(recipientIds).map((recipientId) => ({
            userId: recipientId,
            type: "query_activity",
            actorUserId,
            title,
            body: getRichTextPreview(body, 120),
            href,
            queryId,
            answerId: answerId ?? null,
        }))
    );
}

export async function notifyMentions({
    actorUserId,
    content,
    href,
    title,
    queryId,
    answerId,
}: {
    actorUserId: string;
    content: string;
    href: string;
    title: string;
    queryId?: string;
    answerId?: string;
}) {
    const usernames = extractMentionedUsernames(content);

    if (usernames.length === 0) {
        return;
    }

    const mentionedUsers = await db.selectFrom("user")
        .leftJoin("profiles", "profiles.user_id", "user.id")
        .select(["user.id", "user.username", "profiles.mention_notifications"])
        .where("user.username", "in", usernames)
        .where("user.id", "!=", actorUserId)
        .execute();

    const interactedUsers = queryId ? await getInteractedUserIds(queryId) : new Set<string>();

    const notifications = mentionedUsers
        .filter((user) => {
            if (user.mention_notifications === "interacted_only") {
                return queryId ? interactedUsers.has(user.id) : false;
            }

            return true;
        })
        .map((user) => ({
            userId: user.id,
            type: "mention",
            actorUserId,
            sourceId: user.username ?? null,
            title,
            body: getRichTextPreview(content, 120),
            href,
            queryId: queryId ?? null,
            answerId: answerId ?? null,
        }));

    await insertNotifications(notifications);
}

export async function getNotificationPageItems(userId: string) {
    return db.selectFrom("notifications")
        .leftJoin("user", "user.id", "notifications.actor_user_id")
        .select([
            "notifications.id",
            "notifications.type",
            "notifications.title",
            "notifications.body",
            "notifications.href",
            "notifications.is_read",
            "notifications.created_at",
            "user.displayUsername",
            "user.username",
            "user.name",
        ])
        .where("notifications.user_id", "=", userId)
        .orderBy("notifications.created_at", "desc")
        .limit(50)
        .execute();
}

export async function refreshProfileMetrics(userId: string) {
    const [queryAggregate, answerAggregate, acceptedAggregate, bansAggregate] = await Promise.all([
        db.selectFrom("queries")
            .select(({ fn }) => [
                fn.count<number>("id").as("count"),
                sql<number>`coalesce(sum(score), 0)`.as("score"),
            ])
            .where("user_id", "=", userId)
            .executeTakeFirst(),
        db.selectFrom("answers")
            .select(({ fn }) => [
                fn.count<number>("id").as("count"),
                sql<number>`coalesce(sum(score), 0)`.as("score"),
            ])
            .where("user_id", "=", userId)
            .executeTakeFirst(),
        db.selectFrom("queries")
            .innerJoin("answers", "answers.id", "queries.accepted_answer_id")
            .select(({ fn }) => fn.count<number>("queries.id").as("count"))
            .where("answers.user_id", "=", userId)
            .executeTakeFirst(),
        db.selectFrom("bans_and_timeouts")
            .select(({ fn }) => fn.count<number>("id").as("count"))
            .where("user_id", "=", userId)
            .where("status", "=", "active")
            .executeTakeFirst(),
    ]);

    const queryScore = Number(queryAggregate?.score ?? 0);
    const answerScore = Number(answerAggregate?.score ?? 0);

    await db.updateTable("profiles")
        .set({
            reputation: queryScore + answerScore,
            questions_asked: Number(queryAggregate?.count ?? 0),
            replies_provided: Number(answerAggregate?.count ?? 0),
            replies_accepted: Number(acceptedAggregate?.count ?? 0),
            active_bans_count: Number(bansAggregate?.count ?? 0),
            updated_at: new Date(),
        })
        .where("user_id", "=", userId)
        .execute();
}