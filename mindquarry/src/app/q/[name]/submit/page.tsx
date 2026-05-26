import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUUID } from "@/lib/utils";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isRateLimited } from "@/lib/rateLimit";
import { SubmitQueryForm } from "./SubmitQueryForm";
import { hasRichTextContent } from "@/lib/utils";
import { canViewQuarry } from "@/lib/visibility";
import { normalizeMentionContent } from "@/lib/mentions";
import { notifyMentions, refreshProfileMetrics, subscribeUserToQuery } from "@/lib/notifications";
import { MindQuarryConfig } from "@/lib/config";
import { getEffectivePostingPolicy, shouldReviewQuery } from "@/lib/moderation";
import { assignTagsToQuery, getAvailableTagsForQuarry } from "@/lib/tags";
import { isGlobalAdmin } from "@/lib/admin";

type SubmitQueryResult = {
    ok: boolean;
    error?: string;
};

export default async function SubmitQueryPage({ params }: { params: Promise<{ name: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");
    const viewerIsGlobalAdmin = await isGlobalAdmin(session.user.id);

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").select(["id", "name", "visibility", "is_invite_only", "allow_user_tags"]).where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const availableTags = await getAvailableTagsForQuarry(quarry.id, quarry.name || resolvedParams.name);

    const access = await canViewQuarry(quarry, session.user.id, viewerIsGlobalAdmin);
    if (!access.allowed) {
        redirect(`/q/${quarry.name}`);
    }

    async function submitQuery(formData: FormData): Promise<SubmitQueryResult | void> {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return { ok: false, error: "You must be signed in to post." };
        }

        if (isRateLimited(session.user.id, "submit_query", MindQuarryConfig.FORUM.MAX_QUERIES_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            console.warn(`User ${session.user.id} rate limited on query submission.`);
            return { ok: false, error: "You are posting too quickly. Try again in a moment." };
        }

        const title = formData.get("title") as string;
        const body = formData.get("body") as string;
        const selectedTagIds = formData.getAll("tag_ids").map(String);
        const customTagInput = (formData.get("custom_tags") as string | null) || "";

        if (!title?.trim() || !hasRichTextContent(body)) {
            return { ok: false, error: "Both the title and body are required." };
        }

        const postingPolicy = await getEffectivePostingPolicy({
            quarryId: quarry!.id,
            userId: session.user.id,
        });

        if (!postingPolicy.canPostQueries) {
            return { ok: false, error: "You are not allowed to post new queries in this quarry." };
        }

        const requiresReview = shouldReviewQuery(postingPolicy);
        const normalizedBody = (await normalizeMentionContent(body, session.user.id)).content;

        let newQueryId: string | null = null;
        try {
            const query = await db.insertInto("queries").values({
                id: generateUUID(),
                quarry_id: quarry!.id,
                user_id: session.user.id,
                title,
                body: normalizedBody,
                validation_status: requiresReview ? "pending" : "approved",
            }).returning("id").executeTakeFirst();

            if (query) {
                newQueryId = query.id;
                await assignTagsToQuery({
                    queryId: query.id,
                    quarryId: quarry!.id,
                    quarryName: quarry!.name || resolvedParams.name,
                    selectedTagIds,
                    customTagInput,
                    userId: session.user.id,
                    allowUserTags: quarry!.allow_user_tags ?? false,
                });
                await subscribeUserToQuery(query.id, session.user.id, "author");
                if (!requiresReview) {
                    await notifyMentions({
                        actorUserId: session.user.id,
                        content: normalizedBody,
                        href: `/q/${quarry!.name}/query/${query.id}`,
                        title: `${session.user.name || "Someone"} mentioned you in a question`,
                        queryId: query.id,
                    });
                }
                await refreshProfileMetrics(session.user.id);
            }
        } catch (error) {
            console.error("Failed to create query", error);
            return { ok: false, error: "Failed to create query." };
        }

        if (newQueryId) {
            if (requiresReview) {
                revalidatePath(`/q/${quarry!.name}/mod/queue`);
                redirect(`/q/${quarry!.name}?queued=query`);
            }

            redirect(`/q/${quarry!.name}/query/${newQueryId}`);
        }

        return { ok: false, error: "Failed to create query." };
    }

    return (
        <div className="max-w-2xl mx-auto mt-12 p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
            <h1 className="text-2xl font-black mb-6 uppercase border-b-2 border-black dark:border-white pb-2">Submit Query to q/{quarry.name}</h1>
            <SubmitQueryForm submitAction={submitQuery} availableTags={availableTags} allowCustomTags={quarry.allow_user_tags ?? false} />
        </div>
    );
}
