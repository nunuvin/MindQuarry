import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const resolvedParams = await params;
    const conversationId = resolvedParams.conversationId;

    try {
        await db.updateTable("conversation_participants")
            .set({ last_read_at: new Date() })
            .where("conversation_id", "=", conversationId)
            .where("user_id", "=", session.user.id)
            .execute();

        return new Response("OK", { status: 200 });
    } catch (e) {
        return new Response("Error updating read receipt", { status: 500 });
    }
}
