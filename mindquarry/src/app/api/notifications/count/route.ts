import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { isRateLimited } from "@/lib/rateLimit";

export async function GET() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        return NextResponse.json({ count: 0 }, { status: 200 });
    }

    if (isRateLimited(session.user.id, "notifications_count", 30, 60000)) {
        return NextResponse.json({ count: 0, rateLimited: true }, { status: 429 });
    }

    const count = await getUnreadNotificationCount(session.user.id);
    return NextResponse.json({ count }, { status: 200 });
}
