import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createUserReport } from "@/lib/reports";
import { getRichTextPreview } from "@/lib/utils";
import { canViewQuarry } from "@/lib/visibility";
import { canModerateQuarry } from "@/lib/moderation";
import { isGlobalAdmin } from "@/lib/admin";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";
import { SecurityRateLimits } from "@/lib/security";

export default async function ReportQueryPage({
    params,
    searchParams,
}: {
    params: Promise<{ name: string, id: string }>;
    searchParams: Promise<{ answerId?: string }>;
}) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");

    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const viewerIsGlobalAdmin = await isGlobalAdmin(session.user.id);
    const access = await canViewQuarry(quarry, session.user.id, viewerIsGlobalAdmin);
    if (!access.allowed) {
        return notFound();
    }

    const membership = await db.selectFrom("quarry_members")
        .select("role")
        .where("quarry_id", "=", quarry.id)
        .where("user_id", "=", session.user.id)
        .executeTakeFirst();
    const canModerate = viewerIsGlobalAdmin || canModerateQuarry(membership?.role || null);

    const query = await db.selectFrom("queries")
        .selectAll()
        .where("id", "=", resolvedParams.id)
        .where("quarry_id", "=", quarry.id)
        .where("is_hidden", "=", false)
        .executeTakeFirst();
    if (!query) return notFound();

    if (query.validation_status !== "approved" && !canModerate && session.user.id !== query.user_id) {
        return notFound();
    }

    const answer = resolvedSearchParams.answerId
        ? await db.selectFrom("answers")
            .selectAll()
            .where("id", "=", resolvedSearchParams.answerId)
            .where("query_id", "=", query.id)
            .where("is_hidden", "=", false)
            .executeTakeFirst()
        : null;

    if (resolvedSearchParams.answerId && !answer) {
        return notFound();
    }

    if (answer && answer.validation_status !== "approved" && !canModerate && session.user.id !== answer.user_id) {
        return notFound();
    }

    const targetType = answer ? "answer" : "query";
    const targetId = answer?.id || query.id;
    const targetPreview = answer
        ? getRichTextPreview(answer.body || "", 220)
        : getRichTextPreview(query.body || "", 220) || query.title || "";
    const reportedId = answer?.user_id || query.user_id;
    const targetTitle = answer ? "Reported answer" : query.title;

    async function submitReport(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        if (isRateLimited(session.user.id, "submit_content_report", SecurityRateLimits.REPORT_SUBMISSIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) return;

        const reason = formData.get("reason") as string;
        if (!reason) return;

        await createUserReport({
            quarryId: quarry!.id,
            targetType,
            targetId,
            reporterId: session.user.id,
            reportedId,
            reason,
            targetPreview,
        });

        redirect(`/q/${quarry!.name}/query/${query!.id}`);
    }

    return (
        <div className="max-w-2xl mx-auto mt-12 p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
            <Link href={`/q/${quarry.name}/query/${query.id}`} className="text-sm font-bold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to Query</Link>
            <h1 className="text-2xl font-black mb-6 uppercase border-b-2 border-black dark:border-white pb-2 text-red-500">Report Content</h1>
            <div className="mb-6 p-4 bg-muted/30 border-l-4 border-black dark:border-white font-medium text-sm">
                <span className="font-bold block mb-1 uppercase text-xs text-muted-foreground">Target</span>
                {targetTitle}
                {answer && targetPreview && <div className="mt-3 text-muted-foreground">{targetPreview}</div>}
            </div>
            <form action={submitReport} className="space-y-6">
                <div>
                    <label className="block font-bold mb-2">Reason for Report</label>
                    <textarea name="reason" required rows={5} className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-red-500" placeholder="Please explain why this content violates the rules..."></textarea>
                </div>
                <button type="submit" className="w-full py-3 font-bold border-[3px] border-black dark:border-white bg-red-500 text-white hover:bg-red-600 transition-colors shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer uppercase">
                    Submit Report to {answer ? "Moderators" : "Moderators"}
                </button>
            </form>
        </div>
    );
}
