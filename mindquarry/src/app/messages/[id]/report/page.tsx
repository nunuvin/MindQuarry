import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyGlobalAdmins } from "@/lib/notifications";
import { buildConversationContextSnapshot, createUserReport } from "@/lib/reports";
import { getSiteSettings } from "@/lib/settings";
import { getRichTextPreview } from "@/lib/utils";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";
import { SecurityRateLimits } from "@/lib/security";

export default async function ReportConversationPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ messageId?: string }>;
}) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) {
        redirect("/login");
    }

    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const participant = await db.selectFrom("conversation_participants")
        .select("conversation_id")
        .where("conversation_id", "=", resolvedParams.id)
        .where("user_id", "=", session.user.id)
        .executeTakeFirst();

    if (!participant) {
        return notFound();
    }

    const conversation = await db.selectFrom("conversations")
        .selectAll()
        .where("id", "=", resolvedParams.id)
        .executeTakeFirst();
    if (!conversation) {
        return notFound();
    }

    const reportedMessage = resolvedSearchParams.messageId
        ? await db.selectFrom("messages")
            .leftJoin("user", "user.id", "messages.sender_id")
            .select([
                "messages.id",
                "messages.body",
                "messages.sender_id",
                "messages.created_at",
                "messages.is_hidden",
                "user.name",
                "user.displayUsername",
                "user.username",
            ])
            .where("messages.id", "=", resolvedSearchParams.messageId)
            .where("messages.conversation_id", "=", resolvedParams.id)
            .executeTakeFirst()
        : null;

    if (resolvedSearchParams.messageId && (!reportedMessage || reportedMessage.is_hidden)) {
        return notFound();
    }

    const settings = await getSiteSettings();
    const contextSize = Math.max(1, Math.min(500, settings?.chat_report_context_size || 100));
    const targetType = reportedMessage ? "message" : "conversation";
    const targetId = reportedMessage?.id || conversation.id;
    const targetPreview = reportedMessage
        ? getRichTextPreview(reportedMessage.body || "", 220)
        : conversation.name || "Conversation report";

    async function submitReport(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            redirect("/login");
        }

        const membership = await db.selectFrom("conversation_participants")
            .select("conversation_id")
            .where("conversation_id", "=", resolvedParams.id)
            .where("user_id", "=", session.user.id)
            .executeTakeFirst();

        if (!membership) {
            return;
        }

        if (isRateLimited(session.user.id, "submit_chat_report", SecurityRateLimits.REPORT_SUBMISSIONS_PER_MIN, MindQuarryConfig.RATE_LIMIT_WINDOW_MS)) {
            return;
        }

        const reason = (formData.get("reason") as string | null)?.trim();
        if (!reason) {
            return;
        }

        const snapshot = await buildConversationContextSnapshot(resolvedParams.id, contextSize);

        await createUserReport({
            targetType,
            targetId,
            conversationId: resolvedParams.id,
            reporterId: session.user.id,
            reportedId: reportedMessage?.sender_id || null,
            reason,
            targetPreview,
            contextSnapshot: snapshot,
            contextSize,
        });

        await notifyGlobalAdmins({
            actorUserId: session.user.id,
            title: reportedMessage ? "Chat message reported" : "Conversation reported",
            body: reportedMessage
                ? "A chat message was reported and sent to the instance moderation queue."
                : "A conversation was reported and sent to the instance moderation queue.",
            href: "/admin/reports",
            type: "chat_report",
            sourceId: targetId,
        });

        redirect(`/messages/${resolvedParams.id}`);
    }

    return (
        <div className="page-shell max-w-2xl">
            <div className="soft-panel p-8 sm:p-10">
                <Link href={`/messages/${resolvedParams.id}`} className="soft-button mb-6 inline-flex rounded-full px-4 py-2">
                    &larr; Back to chat
                </Link>

                <h1 className="font-display text-3xl font-semibold tracking-tight text-red-500">
                    {reportedMessage ? "Report Message" : "Report Conversation"}
                </h1>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    This sends the report to instance admins and includes the latest {contextSize} chat messages as context.
                </p>

                <div className="mt-6 rounded-[24px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Target</div>
                    <div className="mt-2 text-sm text-foreground">
                        {reportedMessage ? targetPreview || "Message without text content." : conversation.name || "Conversation"}
                    </div>
                </div>

                <form action={submitReport} className="mt-6 space-y-6">
                    <div>
                        <label className="block text-sm font-semibold">Reason for report</label>
                        <textarea
                            name="reason"
                            required
                            rows={6}
                            className="mt-2 w-full rounded-[24px] border border-border/70 bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="Explain what happened and why instance admins should review it."
                        />
                    </div>
                    <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">
                        Submit to instance admins
                    </button>
                </form>
            </div>
        </div>
    );
}