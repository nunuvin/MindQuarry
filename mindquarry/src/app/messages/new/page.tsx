import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { generateUUID } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { UsersRound } from "lucide-react";

export default async function NewGroupChatPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const settings = await getSiteSettings();
    if (settings?.simplified_mode_enabled) {
        redirect("/messages");
    }

    async function createGroup(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const name = formData.get("name") as string;
        if (!name) return;

        const convId = generateUUID();

        await db.transaction().execute(async (trx) => {
            await trx.insertInto("conversations").values({
                id: convId,
                is_group: true,
                name,
                created_by_id: session.user.id
            }).execute();

            await trx.insertInto("conversation_participants").values({
                conversation_id: convId,
                user_id: session.user.id,
                role: 'admin'
            }).execute();
        });

        redirect(`/messages/${convId}`);
    }

    return (
        <div className="page-shell max-w-3xl">
            <div className="soft-panel p-8 sm:p-10">
                <Link href="/messages" className="text-sm font-semibold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to Inbox</Link>

                <div className="mb-8">
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">Group Chats</p>
                    <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">Create Group Chat</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Set up a room for planning, moderation, or long-running discussions with the same softer compose pattern as search.</p>
                </div>

                <form action={createGroup} className="space-y-6">
                    <div>
                        <label className="mb-3 block text-sm font-medium">Group Name</label>
                        <div className="relative flex items-center overflow-hidden rounded-full border border-border/70 bg-card/85 shadow-sm transition duration-200 focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]">
                            <UsersRound className="absolute left-4 h-4 w-4 text-muted-foreground" />
                            <div className="absolute left-10 h-5 w-px bg-border/80" />
                            <Input name="name" required className="h-12 border-0 bg-transparent pl-14 pr-4 text-sm shadow-none focus-visible:ring-0" placeholder="What do you want to call this group?" />
                        </div>
                    </div>

                    <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">
                        Initialize Group
                    </button>
                </form>
            </div>
        </div>
    );
}
