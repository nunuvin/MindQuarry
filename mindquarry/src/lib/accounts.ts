import { db } from "./db";

export const DELETED_USER_ID = "-1";

export async function ensureDeletedUserRecord() {
    const existing = await db.selectFrom("user")
        .select("id")
        .where("id", "=", DELETED_USER_ID)
        .executeTakeFirst();

    if (existing) {
        return existing.id;
    }

    const now = new Date();

    const inserted = await db.insertInto("user")
        .values({
            id: DELETED_USER_ID,
            name: "Deleted User",
            email: "deleted-user@mindquarry.local",
            emailVerified: true,
            image: null,
            createdAt: now,
            updatedAt: now,
            username: "deleted-user",
            displayUsername: "Deleted User",
            role: "system",
            banned: true,
            banReason: "System placeholder for deleted accounts.",
            banExpires: null,
        })
        .onConflict((oc) => oc.column("id").doNothing())
        .returning("id")
        .executeTakeFirst();

    return inserted?.id || DELETED_USER_ID;
}

export async function deleteUserAccount(options: {
    actorUserId: string;
    targetUserId: string;
    allowAdminDelete?: boolean;
    protectedUserIds?: string[];
}) {
    if (options.targetUserId === DELETED_USER_ID) {
        return { ok: false, error: "The deleted-user placeholder cannot be removed." };
    }

    if (!options.allowAdminDelete && options.actorUserId !== options.targetUserId) {
        return { ok: false, error: "You cannot delete this account." };
    }

    if (options.protectedUserIds?.includes(options.targetUserId)) {
        return { ok: false, error: "This protected account cannot be deleted." };
    }

    const targetUser = await db.selectFrom("user")
        .select(["id", "username"])
        .where("id", "=", options.targetUserId)
        .executeTakeFirst();

    if (!targetUser) {
        return { ok: false, error: "User not found." };
    }

    const deletedUserId = await ensureDeletedUserRecord();

    await db.transaction().execute(async (trx) => {
        await trx.updateTable("queries")
            .set({ user_id: deletedUserId, updated_at: new Date() })
            .where("user_id", "=", options.targetUserId)
            .execute();

        await trx.updateTable("answers")
            .set({ user_id: deletedUserId, updated_at: new Date() })
            .where("user_id", "=", options.targetUserId)
            .execute();

        await trx.updateTable("messages")
            .set({ sender_id: deletedUserId })
            .where("sender_id", "=", options.targetUserId)
            .execute();

        await trx.updateTable("conversations")
            .set({ created_by_id: deletedUserId })
            .where("created_by_id", "=", options.targetUserId)
            .execute();

        await trx.updateTable("mod_actions")
            .set({ moderator_id: deletedUserId })
            .where("moderator_id", "=", options.targetUserId)
            .execute();

        await trx.updateTable("user_reports")
            .set({ reporter_id: deletedUserId })
            .where("reporter_id", "=", options.targetUserId)
            .execute();

        await trx.updateTable("user_reports")
            .set({ reported_id: deletedUserId })
            .where("reported_id", "=", options.targetUserId)
            .execute();

        await trx.updateTable("notifications")
            .set({ actor_user_id: deletedUserId })
            .where("actor_user_id", "=", options.targetUserId)
            .execute();

        await trx.updateTable("bans_and_timeouts")
            .set({ issued_by_id: deletedUserId })
            .where("issued_by_id", "=", options.targetUserId)
            .execute();

        await trx.deleteFrom("global_admins")
            .where("user_id", "=", options.targetUserId)
            .execute();

        await trx.deleteFrom("user")
            .where("id", "=", options.targetUserId)
            .execute();
    });

    return {
        ok: true,
        username: targetUser.username,
    };
}