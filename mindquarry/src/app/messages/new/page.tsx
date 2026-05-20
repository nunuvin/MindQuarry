import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { generateUUID } from "@/lib/utils";

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
        <div className="max-w-2xl mx-auto mt-12 p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
            <Link href="/messages" className="text-sm font-bold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to Inbox</Link>

            <h1 className="text-2xl font-black mb-6 uppercase border-b-2 border-black dark:border-white pb-2">Create Group Chat</h1>

            <form action={createGroup} className="space-y-6">
                <div>
                    <label className="block font-bold mb-2">Group Name</label>
                    <input name="name" required className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="e.g. Server Architecture Planning" />
                </div>

                <button type="submit" className="w-full py-3 font-bold border-[3px] border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition-colors shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer uppercase">
                    Initialize Group
                </button>
            </form>
        </div>
    );
}
