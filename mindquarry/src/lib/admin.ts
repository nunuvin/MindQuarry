import { db } from "./db";
import { getSiteSettings } from "./settings";

/**
 * Validates if the requested user ID possesses Global Administrator privileges.
 * It checks both the indestructible fallback `first_admin_user_id` inside site settings
 * and the extensible `global_admins` permission mapping table.
 *
 * @param {string} userId - The string UUID of the user being validated.
 * @returns {Promise<boolean>} True if the user holds global privileges.
 */
export async function isGlobalAdmin(userId: string): Promise<boolean> {
    const settings = await getSiteSettings();
    if (settings?.first_admin_user_id === userId) return true;

    const admin = await db.selectFrom("global_admins").select("user_id").where("user_id", "=", userId).executeTakeFirst();
    return !!admin;
}
