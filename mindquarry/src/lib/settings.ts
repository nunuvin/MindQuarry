import { db } from "./db";

/**
 * Retrieves the global site settings configuration row from the database.
 * If the configuration row does not exist, it securely bootstraps the default values.
 *
 * @returns {Promise<SiteSettingsTable | undefined>} The global configuration object
 */
export async function getSiteSettings() {
    let settings = await db.selectFrom("site_settings").selectAll().executeTakeFirst();
    if (!settings) {
        await db.insertInto("site_settings").values({
            id: 1,
            registration_enabled: true,
            simplified_mode_enabled: false,
            admin_monitoring_dms: false,
        }).execute();
        settings = await db.selectFrom("site_settings").selectAll().executeTakeFirst();
    }
    return settings;
}
