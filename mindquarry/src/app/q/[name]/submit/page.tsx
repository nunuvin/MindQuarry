import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUUID } from "@/lib/utils";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { TipTapEditor } from "@/components/TipTapEditor";
import { isRateLimited } from "@/lib/rateLimit";

export default async function SubmitQueryPage({ params }: { params: Promise<{ name: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").select(["id", "name"]).where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    async function submitQuery(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        // Rate limit: Max 5 queries per minute
        if (isRateLimited(session.user.id, "submit_query", 5, 60000)) {
            console.warn(`User ${session.user.id} rate limited on query submission.`);
            return;
        }

        const title = formData.get("title") as string;
        const body = formData.get("body") as string;

        if (!title || !body) return;

        let newQueryId: string | null = null;
        try {
            const query = await db.insertInto("queries").values({
                id: generateUUID(),
                quarry_id: quarry!.id,
                user_id: session.user.id,
                title,
                body,
            }).returning("id").executeTakeFirst();

            if (query) {
                newQueryId = query.id;
            }
        } catch (e) {
            console.error("Failed to create query", e);
        }

        if (newQueryId) {
            redirect(`/q/${quarry!.name}/query/${newQueryId}`);
        }
    }

    return (
        <div className="max-w-2xl mx-auto mt-12 p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
            <h1 className="text-2xl font-black mb-6 uppercase border-b-2 border-black dark:border-white pb-2">Submit Query to q/{quarry.name}</h1>
            <form action={submitQuery} className="space-y-6">
                <div>
                    <label className="block font-bold mb-2">Title</label>
                    <input name="title" required className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="What is your question?" />
                </div>
                <div>
                    <label className="block font-bold mb-2">Body</label>
                    <TipTapEditor name="body" />
                </div>
                <button type="submit" className="cursor-pointer w-full py-3 font-bold border-[3px] border-black dark:border-white bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                    Post Query
                </button>
            </form>
        </div>
    );
}
