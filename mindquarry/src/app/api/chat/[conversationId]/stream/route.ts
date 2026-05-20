import { NextRequest } from "next/server";
import { getSharedPgListener, chatEventEmitter } from "@/lib/pgListener";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const resolvedParams = await params;
    const conversationId = resolvedParams.conversationId;

    // Verify participation
    const participant = await db.selectFrom("conversation_participants")
        .where("conversation_id", "=", conversationId)
        .where("user_id", "=", session.user.id)
        .executeTakeFirst();
    if (!participant) {
        return new Response("Forbidden", { status: 403 });
    }

    // Ensure the shared listener is connected
    await getSharedPgListener();

    const stream = new ReadableStream({
        start(controller) {
            const onMessage = (payload: string) => {
                if (payload === conversationId) {
                    controller.enqueue(`data: {"type": "new_message", "conversationId": "${conversationId}"}\n\n`);
                }
            };

            const onReadReceipt = (payload: string) => {
                if (payload === conversationId) {
                    controller.enqueue(`data: {"type": "read_receipt", "conversationId": "${conversationId}"}\n\n`);
                }
            };

            chatEventEmitter.on("new_message_event", onMessage);
            chatEventEmitter.on("read_receipt_event", onReadReceipt);

            // Keep alive heartbeat
            const interval = setInterval(() => {
                controller.enqueue(`: ping\n\n`);
            }, 30000);

            req.signal.addEventListener("abort", () => {
                clearInterval(interval);
                chatEventEmitter.off("new_message_event", onMessage);
                chatEventEmitter.off("read_receipt_event", onReadReceipt);
            });
        },
        cancel() {
            // Nothing to do for cancellation on the stream side
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    });
}
