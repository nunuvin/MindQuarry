import { NextRequest, NextResponse } from "next/server";

import { isGlobalAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { MindQuarryConfig } from "@/lib/config";
import { isRateLimited } from "@/lib/rateLimit";
import { buildSearchRateLimitKey, runSearch, type SearchSection } from "@/lib/search";

function parseOffset(value: string | null) {
    const parsed = Number.parseInt(value || "0", 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseMode(value: string | null) {
    return value === "more" ? "more" : "initial";
}

function parseSection(value: string | null) {
    if (value === "users" || value === "quarries" || value === "queries") {
        return value satisfies SearchSection;
    }

    return null;
}

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    const viewerIsGlobalAdmin = session?.user?.id ? await isGlobalAdmin(session.user.id) : false;
    const rawQuery = request.nextUrl.searchParams.get("q") || "";
    const mode = parseMode(request.nextUrl.searchParams.get("mode"));
    const section = parseSection(request.nextUrl.searchParams.get("section"));
    const offset = parseOffset(request.nextUrl.searchParams.get("offset"));

    const rateLimitKey = buildSearchRateLimitKey(request.headers, session?.user?.id);
    const maxRequests = mode === "initial"
        ? MindQuarryConfig.SEARCH.MAX_INITIAL_REQUESTS_PER_MIN
        : MindQuarryConfig.SEARCH.MAX_FOLLOW_UP_REQUESTS_PER_MIN;

    if (isRateLimited(rateLimitKey, `search:${mode}:${section || "all"}`, maxRequests, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
        return NextResponse.json({ error: "Search rate limited." }, { status: 429 });
    }

    const payload = await runSearch({
        rawQuery,
        viewerId: session?.user?.id,
        viewerIsGlobalAdmin,
        mode,
        section,
        offset,
    });

    return NextResponse.json(payload, { status: 200 });
}