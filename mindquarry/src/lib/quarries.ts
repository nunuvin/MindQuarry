import { db } from "./db";
import { sql } from "kysely";

export type QuarryNavigationOption = {
    id: string;
    name: string | null;
    role: string | null;
};

export async function listQuarryNavigationOptions(options: {
    userId?: string | null;
    viewerIsGlobalAdmin?: boolean;
} = {}) {
    if (options.viewerIsGlobalAdmin) {
        return db.selectFrom("quarries")
            .select([
                "quarries.id",
                "quarries.name",
                sql<string>`'admin'`.as("role"),
            ])
            .where("quarries.name", "is not", null)
            .orderBy("quarries.name", "asc")
            .execute() as Promise<Array<{ id: string; name: string; role: string }>>;
    }

    if (!options.userId) {
        return [] as QuarryNavigationOption[];
    }

    return db.selectFrom("quarry_members")
        .innerJoin("quarries", "quarries.id", "quarry_members.quarry_id")
        .select(["quarries.id", "quarries.name", "quarry_members.role"])
        .where("quarry_members.user_id", "=", options.userId)
        .where((eb) => eb.or([
            eb("quarry_members.role", "=", "admin"),
            eb("quarry_members.role", "=", "moderator"),
        ]))
        .where("quarries.name", "is not", null)
        .orderBy("quarries.name", "asc")
        .execute() as Promise<Array<{ id: string; name: string; role: string | null }>>;
}