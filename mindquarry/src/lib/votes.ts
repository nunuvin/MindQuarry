import { sql } from "kysely";

import { db } from "./db";
import { refreshProfileMetrics } from "./notifications";

export async function applyQueryVote(queryId: string, userId: string, value: 1 | -1) {
    let authorId: string | null = null;

    await db.transaction().execute(async (trx) => {
        const query = await trx.selectFrom("queries")
            .select("user_id")
            .where("id", "=", queryId)
            .executeTakeFirst();

        authorId = query?.user_id ?? null;

        const existing = await trx.selectFrom("query_votes")
            .select("value")
            .where("query_id", "=", queryId)
            .where("user_id", "=", userId)
            .executeTakeFirst();

        if (existing?.value === value) {
            await trx.deleteFrom("query_votes")
                .where("query_id", "=", queryId)
                .where("user_id", "=", userId)
                .execute();

            await trx.updateTable("queries")
                .set({ score: sql<number>`coalesce(score, 0) - ${value}` })
                .where("id", "=", queryId)
                .execute();

            return;
        }

        if (existing) {
            await trx.updateTable("query_votes")
                .set({ value })
                .where("query_id", "=", queryId)
                .where("user_id", "=", userId)
                .execute();

            await trx.updateTable("queries")
                .set({ score: sql<number>`coalesce(score, 0) + ${value * 2}` })
                .where("id", "=", queryId)
                .execute();

            return;
        }

        await trx.insertInto("query_votes").values({
            query_id: queryId,
            user_id: userId,
            value,
        }).execute();

        await trx.updateTable("queries")
            .set({ score: sql<number>`coalesce(score, 0) + ${value}` })
            .where("id", "=", queryId)
            .execute();
    });

    if (authorId) {
        await refreshProfileMetrics(authorId);
    }
}

export async function applyAnswerVote(answerId: string, userId: string, value: 1 | -1) {
    let authorId: string | null = null;

    await db.transaction().execute(async (trx) => {
        const answer = await trx.selectFrom("answers")
            .select("user_id")
            .where("id", "=", answerId)
            .executeTakeFirst();

        authorId = answer?.user_id ?? null;

        const existing = await trx.selectFrom("answer_votes")
            .select("value")
            .where("answer_id", "=", answerId)
            .where("user_id", "=", userId)
            .executeTakeFirst();

        if (existing?.value === value) {
            await trx.deleteFrom("answer_votes")
                .where("answer_id", "=", answerId)
                .where("user_id", "=", userId)
                .execute();

            await trx.updateTable("answers")
                .set({ score: sql<number>`coalesce(score, 0) - ${value}` })
                .where("id", "=", answerId)
                .execute();

            return;
        }

        if (existing) {
            await trx.updateTable("answer_votes")
                .set({ value })
                .where("answer_id", "=", answerId)
                .where("user_id", "=", userId)
                .execute();

            await trx.updateTable("answers")
                .set({ score: sql<number>`coalesce(score, 0) + ${value * 2}` })
                .where("id", "=", answerId)
                .execute();

            return;
        }

        await trx.insertInto("answer_votes").values({
            answer_id: answerId,
            user_id: userId,
            value,
        }).execute();

        await trx.updateTable("answers")
            .set({ score: sql<number>`coalesce(score, 0) + ${value}` })
            .where("id", "=", answerId)
            .execute();
    });

    if (authorId) {
        await refreshProfileMetrics(authorId);
    }
}