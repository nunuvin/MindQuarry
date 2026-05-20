import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateUUID } from "@/lib/utils";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function ReportQueryPage({ params }: { params: Promise<{ name: string, id: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    const query = await db.selectFrom("queries").selectAll().where("id", "=", resolvedParams.id).executeTakeFirst();
    if (!query) return notFound();

    async function submitReport(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const reason = formData.get("reason") as string;
        if (!reason) return;

        await db.insertInto("user_reports").values({
            id: generateUUID(),
            quarry_id: quarry!.id,
            target_type: "query",
            target_id: query!.id,
            reporter_id: session.user.id,
            reported_id: query!.user_id,
            reason,
        }).execute();

        redirect(`/q/${quarry!.name}/query/${query!.id}`);
    }

    return (
        <div className="max-w-2xl mx-auto mt-12 p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
            <Link href={`/q/${quarry.name}/query/${query.id}`} className="text-sm font-bold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to Query</Link>
            <h1 className="text-2xl font-black mb-6 uppercase border-b-2 border-black dark:border-white pb-2 text-red-500">Report Content</h1>
            <div className="mb-6 p-4 bg-muted/30 border-l-4 border-black dark:border-white font-medium text-sm">
                <span className="font-bold block mb-1 uppercase text-xs text-muted-foreground">Target</span>
                {query.title}
            </div>
            <form action={submitReport} className="space-y-6">
                <div>
                    <label className="block font-bold mb-2">Reason for Report</label>
                    <textarea name="reason" required rows={5} className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-red-500" placeholder="Please explain why this content violates the rules..."></textarea>
                </div>
                <button type="submit" className="w-full py-3 font-bold border-[3px] border-black dark:border-white bg-red-500 text-white hover:bg-red-600 transition-colors shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer uppercase">
                    Submit Report to Moderators
                </button>
            </form>
        </div>
    );
}
