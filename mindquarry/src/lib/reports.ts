import { db } from "./db";
import { notifyGlobalAdmins } from "./notifications";
import { generateUUID, richTextToPlainText } from "./utils";

type CreateUserReportInput = {
    quarryId?: string | null;
    targetType: string;
    targetId: string;
    conversationId?: string | null;
    reporterId: string;
    reportedId?: string | null;
    reason: string;
    targetPreview?: string | null;
    contextSnapshot?: string | null;
    contextSize?: number | null;
};

type ChatContextMessage = {
    body: string | null;
    created_at: Date | null;
    displayUsername: string | null;
    username: string | null;
    name: string | null;
};

function formatChatContextMessage(message: ChatContextMessage) {
    const author = message.displayUsername || message.username || message.name || "Unknown user";
    const when = message.created_at ? new Date(message.created_at).toLocaleString() : "Unknown time";
    const text = richTextToPlainText(message.body || "").trim();

    return `${author} [${when}]\n${text}`.trimEnd();
}

export async function createUserReport(input: CreateUserReportInput) {
    await db.insertInto("user_reports").values({
        id: generateUUID(),
        quarry_id: input.quarryId ?? null,
        target_type: input.targetType,
        target_id: input.targetId,
        conversation_id: input.conversationId ?? null,
        reporter_id: input.reporterId,
        reported_id: input.reportedId ?? null,
        reason: input.reason,
        target_preview: input.targetPreview ?? null,
        context_snapshot: input.contextSnapshot ?? null,
        context_size: input.contextSize ?? null,
    }).execute();
}

export async function buildConversationContextSnapshot(conversationId: string, limit: number) {
    const messages = await db.selectFrom("messages")
        .leftJoin("user", "user.id", "messages.sender_id")
        .select([
            "messages.body",
            "messages.created_at",
            "user.displayUsername",
            "user.username",
            "user.name",
        ])
        .where("messages.conversation_id", "=", conversationId)
        .orderBy("messages.created_at", "desc")
        .limit(limit)
        .execute();

    return messages
        .reverse()
        .map(formatChatContextMessage)
        .filter(Boolean)
        .join("\n\n");
}

export async function escalateReportsToInstance({
    quarryId,
    quarryName,
    targetId,
    targetType,
    actorUserId,
}: {
    quarryId: string;
    quarryName: string;
    targetId: string;
    targetType: string;
    actorUserId: string;
}) {
    await db.updateTable("user_reports")
        .set({
            status: "escalated",
            quarry_id: null,
            escalated_by_id: actorUserId,
            escalated_from_quarry_id: quarryId,
        })
        .where("target_id", "=", targetId)
        .where("target_type", "=", targetType)
        .execute();

    await notifyGlobalAdmins({
        actorUserId,
        title: `Report escalated from q/${quarryName}`,
        body: `A ${targetType} report in q/${quarryName} was escalated to the instance moderation queue.`,
        href: "/admin/reports",
        type: "report_escalated",
        sourceId: targetId,
    });
}