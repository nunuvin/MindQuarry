import { db } from "./db";
import { getSiteSettings } from "./settings";

export async function isGlobalAdmin(userId: string): Promise<boolean> {
    const settings = await getSiteSettings();
    if (settings?.first_admin_user_id === userId) return true;

    const admin = await db.selectFrom("global_admins").select("user_id").where("user_id", "=", userId).executeTakeFirst();
    return !!admin;
}
