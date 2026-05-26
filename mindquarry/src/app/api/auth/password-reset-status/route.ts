import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";
import { SecurityRateLimits } from "@/lib/security";

export async function GET(request: Request) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ required: false }, { status: 401 });
    }

    if (isRateLimited(session.user.id, "password_reset_status", SecurityRateLimits.PASSWORD_RESET_STATUS_REQUESTS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
        return NextResponse.json({ required: false, rateLimited: true }, { status: 429 });
    }

    const profile = await db.selectFrom("profiles")
        .select("force_password_reset")
        .where("user_id", "=", session.user.id)
        .executeTakeFirst();

    return NextResponse.json({ required: Boolean(profile?.force_password_reset) });
}