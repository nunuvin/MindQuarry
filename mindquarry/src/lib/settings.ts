import { db } from "./db";

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
