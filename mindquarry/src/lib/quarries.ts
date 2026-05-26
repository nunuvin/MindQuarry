import { db } from "./db";

export type QuarryNavigationOption = {
    id: string;
    name: string | null;
};

export async function listQuarryNavigationOptions() {
    return db.selectFrom("quarries")
        .select(["id", "name"])
        .where("name", "is not", null)
        .orderBy("name", "asc")
        .execute() as Promise<Array<{ id: string; name: string }>>;
}