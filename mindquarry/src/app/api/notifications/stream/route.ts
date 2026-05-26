import { NextRequest } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { chatEventEmitter, getSharedPgListener } from "@/lib/pgListener";

export async function GET(req: NextRequest) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    await getSharedPgListener();

    const stream = new ReadableStream({
        start(controller) {
            const emitCount = async () => {
                try {
                    const count = await getUnreadNotificationCount(session.user.id);
                    controller.enqueue(`data: ${JSON.stringify({ type: "notifications_updated", count })}\n\n`);
                } catch {
                    controller.enqueue(`data: ${JSON.stringify({ type: "notifications_updated", count: 0 })}\n\n`);
                }
            };

            const onNotification = (payload: string) => {
                if (payload === session.user.id) {
                    void emitCount();
                }
            };

            chatEventEmitter.on("notification_event", onNotification);
            void emitCount();

            const interval = setInterval(() => {
                controller.enqueue(`: ping\n\n`);
            }, 30000);

            req.signal.addEventListener("abort", () => {
                clearInterval(interval);
                chatEventEmitter.off("notification_event", onNotification);
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    });
}