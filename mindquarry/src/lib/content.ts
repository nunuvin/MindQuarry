import { db } from "./db";
import { DELETED_MESSAGE_TOMBSTONE } from "./messageContent";
import { refreshProfileMetrics } from "./notifications";

export async function updateQueryByAuthor(options: {
    queryId: string;
    userId: string;
    title: string;
    body: string;
}) {
    const updated = await db.updateTable("queries")
        .set({
            title: options.title,
            body: options.body,
            updated_at: new Date(),
        })
        .where("id", "=", options.queryId)
        .where("user_id", "=", options.userId)
        .returning("id")
        .executeTakeFirst();

    return Boolean(updated);
}

export async function updateAnswerByAuthor(options: {
    answerId: string;
    userId: string;
    body: string;
}) {
    const updated = await db.updateTable("answers")
        .set({
            body: options.body,
            updated_at: new Date(),
        })
        .where("id", "=", options.answerId)
        .where("user_id", "=", options.userId)
        .returning("id")
        .executeTakeFirst();

    return Boolean(updated);
}

export async function deleteAnswerByAuthor(options: {
    answerId: string;
    userId: string;
}) {
    return db.transaction().execute(async (trx) => {
        const answer = await trx.selectFrom("answers")
            .select(["id", "query_id", "user_id"])
            .where("id", "=", options.answerId)
            .where("user_id", "=", options.userId)
            .executeTakeFirst();

        if (!answer?.query_id) {
            return null;
        }

        await trx.updateTable("queries")
            .set({ accepted_answer_id: null, updated_at: new Date() })
            .where("id", "=", answer.query_id)
            .where("accepted_answer_id", "=", answer.id)
            .execute();

        await trx.deleteFrom("answers")
            .where("id", "=", answer.id)
            .where("user_id", "=", options.userId)
            .execute();

        return answer.query_id;
    }).then(async (queryId) => {
        if (queryId) {
            await refreshProfileMetrics(options.userId);
        }

        return queryId;
    });
}

export async function deleteMessageBySender(options: {
    messageId: string;
    userId: string;
    allowModeratorDelete?: boolean;
}) {
    return db.transaction().execute(async (trx) => {
        const message = await trx.selectFrom("messages")
            .select(["id", "conversation_id", "sender_id"])
            .where("id", "=", options.messageId)
            .where((eb) => options.allowModeratorDelete
                ? eb.or([
                    eb("sender_id", "=", options.userId),
                    eb("sender_id", "is not", null),
                ])
                : eb("sender_id", "=", options.userId))
            .executeTakeFirst();

        if (!message?.conversation_id) {
            return null;
        }

        let updateQuery = trx.updateTable("messages")
            .set({
                body: DELETED_MESSAGE_TOMBSTONE,
                is_hidden: false,
                hidden_at: null,
                hidden_by_id: null,
            })
            .where("id", "=", message.id);

        if (!options.allowModeratorDelete) {
            updateQuery = updateQuery.where("sender_id", "=", options.userId);
        }

        await updateQuery.execute();

        return message.conversation_id;
    });
}

export async function hideMessage(options: {
    messageId: string;
    actorUserId: string;
}) {
    const hidden = await db.updateTable("messages")
        .set({
            is_hidden: true,
            hidden_at: new Date(),
            hidden_by_id: options.actorUserId,
        })
        .where("id", "=", options.messageId)
        .returning("conversation_id")
        .executeTakeFirst();

    return hidden?.conversation_id || null;
}

export async function deleteQuery(options: {
    queryId: string;
    actorUserId: string;
    isQuarryAdmin: boolean;
}) {
    return db.transaction().execute(async (trx) => {
        const query = await trx.selectFrom("queries")
            .select(["id", "quarry_id", "user_id"])
            .where("id", "=", options.queryId)
            .executeTakeFirst();

        if (!query?.quarry_id) {
            return { ok: false, reason: "missing" as const };
        }

        const answerCountResult = await trx.selectFrom("answers")
            .select(({ fn }) => fn.count<number>("id").as("count"))
            .where("query_id", "=", query.id)
            .executeTakeFirst();

        const answerCount = Number(answerCountResult?.count ?? 0);
        const canAuthorDelete = query.user_id === options.actorUserId && answerCount === 0;
        const canAdminDelete = options.isQuarryAdmin;

        if (!canAuthorDelete && !canAdminDelete) {
            return { ok: false, reason: "forbidden" as const };
        }

        await trx.deleteFrom("queries")
            .where("id", "=", query.id)
            .execute();

        return { ok: true, quarryId: query.quarry_id };
    });
}

export async function setQueryArchived(options: {
    queryId: string;
    actorUserId: string;
    archived: boolean;
}) {
    const updated = await db.updateTable("queries")
        .set({
            is_archived: options.archived,
            archived_at: options.archived ? new Date() : null,
            archived_by_id: options.archived ? options.actorUserId : null,
            updated_at: new Date(),
        })
        .where("id", "=", options.queryId)
        .returning("id")
        .executeTakeFirst();

    return Boolean(updated);
}