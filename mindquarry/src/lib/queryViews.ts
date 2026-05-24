import { createHash } from "node:crypto";

import { sql } from "kysely";

import { MindQuarryConfig } from "./config";
import { db } from "./db";

const UNKNOWN_VIEWER_FINGERPRINT = "anon:unknown";

function buildViewerKey(rawHeaders: Headers, userId?: string | null) {
    if (userId) {
        return createHash("sha256").update(`user:${userId}`).digest("hex");
    }

    const forwardedFor = rawHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const realIp = rawHeaders.get("x-real-ip")?.trim() ?? "";
    const userAgent = rawHeaders.get("user-agent")?.trim() ?? "";
    const fingerprintSource = [forwardedFor || realIp, userAgent].filter(Boolean).join("|") || UNKNOWN_VIEWER_FINGERPRINT;

    return createHash("sha256").update(fingerprintSource).digest("hex");
}

export async function recordQueryView({
    queryId,
    rawHeaders,
    userId,
}: {
    queryId: string;
    rawHeaders: Headers;
    userId?: string | null;
}) {
    const viewerKey = buildViewerKey(rawHeaders, userId);
    const now = new Date();
    const viewWindowMs = MindQuarryConfig.FORUM.UNIQUE_VIEW_WINDOW_MS;
    const cutoff = new Date(now.getTime() - viewWindowMs);

    return db.transaction().execute(async (trx) => {
        const existingView = await trx.selectFrom("query_view_sessions")
            .select("last_viewed_at")
            .where("query_id", "=", queryId)
            .where("viewer_key", "=", viewerKey)
            .executeTakeFirst();

        if (existingView?.last_viewed_at && existingView.last_viewed_at > cutoff) {
            return false;
        }

        if (existingView) {
            await trx.updateTable("query_view_sessions")
                .set({ last_viewed_at: now })
                .where("query_id", "=", queryId)
                .where("viewer_key", "=", viewerKey)
                .execute();
        } else {
            await trx.insertInto("query_view_sessions")
                .values({
                    query_id: queryId,
                    viewer_key: viewerKey,
                    last_viewed_at: now,
                })
                .execute();
        }

        await trx.insertInto("query_views")
            .values({ query_id: queryId, views: 1 })
            .onConflict((oc) => oc.column("query_id").doUpdateSet({ views: sql<number>`query_views.views + 1` }))
            .execute();

        return true;
    });
}
