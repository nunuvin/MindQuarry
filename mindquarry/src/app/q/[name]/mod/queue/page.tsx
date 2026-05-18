import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function QuarryModQueuePage({ params }: { params: Promise<{ name: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");

    const resolvedParams = await params;
    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    // Verify admin
    const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry.id).where("user_id", "=", session.user.id).executeTakeFirst();
    if (!membership || membership.role !== 'admin') {
        return (
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border rounded shadow">
                <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
            </div>
        );
    }

    const reports = await db.selectFrom("user_reports")
        .leftJoin("user as reporter", "reporter.id", "user_reports.reporter_id")
        .leftJoin("user as reported", "reported.id", "user_reports.reported_id")
        .select([
            "user_reports.id", "user_reports.reason", "user_reports.status", "user_reports.created_at",
            "user_reports.target_id", "user_reports.target_type",
            "reporter.name as reporter_name", "reporter.displayUsername as reporter_username",
            "reported.name as reported_name", "reported.displayUsername as reported_username",
            "reported.id as reported_id", "reporter.id as reporter_id"
        ])
        .where("quarry_id", "=", quarry.id)
        .where("status", "=", "pending")
        .orderBy("created_at", "desc")
        .execute();

    async function dismissReport(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || membership.role !== 'admin') return;

        const id = formData.get("id") as string;
        await db.updateTable("user_reports").set({ status: "dismissed" }).where("id", "=", id).execute();
        revalidatePath(`/q/${quarry!.name}/mod/queue`);
    }

    async function hideItem(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || membership.role !== 'admin') return;

        const id = formData.get("id") as string;
        const targetId = formData.get("target_id") as string;
        const targetType = formData.get("target_type") as string;

        if (targetType === "query") {
            await db.updateTable("queries").set({ is_hidden: true, hidden_at: new Date() }).where("id", "=", targetId).execute();
        } else if (targetType === "answer") {
            await db.updateTable("answers").set({ is_hidden: true, hidden_at: new Date() }).where("id", "=", targetId).execute();
        }

        await db.updateTable("user_reports").set({ status: "actioned" }).where("id", "=", id).execute();
        revalidatePath(`/q/${quarry!.name}/mod/queue`);
    }

    return (
        <div className="max-w-6xl mx-auto mt-8 p-4">
            <Link href={`/q/${quarry.name}`} className="text-sm font-bold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to q/{quarry.name}</Link>

            <div className="p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
                <div className="flex justify-between items-center mb-8 border-b-[3px] border-black dark:border-white pb-2">
                    <h1 className="text-3xl font-black uppercase tracking-tight">Mod Queue</h1>
                    <Link href={`/q/${quarry.name}/mod/history`} className="text-blue-500 font-bold hover:underline">View History</Link>
                </div>

                <div className="space-y-8">
                    {reports.map(r => (
                        <div key={r.id} className="grid grid-cols-1 md:grid-cols-3 gap-6 border-[3px] border-black dark:border-white p-4 shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                            <div className="md:col-span-2">
                                <h3 className="font-black uppercase text-lg mb-2">Reported Content ({r.target_type})</h3>
                                <div className="p-4 bg-muted/30 border-l-4 border-red-500 whitespace-pre-wrap font-medium text-sm mb-4">
                                    {r.reason}
                                </div>
                                <div className="flex gap-4">
                                    <form action={dismissReport}>
                                        <input type="hidden" name="id" value={r.id} />
                                        <button type="submit" className="px-4 py-2 font-bold border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]">
                                            Dismiss
                                        </button>
                                    </form>
                                    <form action={hideItem}>
                                        <input type="hidden" name="id" value={r.id} />
                                        <input type="hidden" name="target_id" value={r.target_id || ''} />
                                        <input type="hidden" name="target_type" value={r.target_type || ''} />
                                        <button type="submit" className="px-4 py-2 font-bold border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white cursor-pointer shadow-[2px_2px_0_0_#ef4444]">
                                            Hide Content
                                        </button>
                                    </form>
                                </div>
                            </div>

                            <div className="border-l-2 border-black/20 dark:border-white/20 pl-6 flex flex-col justify-between">
                                <div className="mb-4">
                                    <h4 className="font-bold text-xs uppercase text-muted-foreground mb-1">Reported User</h4>
                                    <div className="font-bold text-lg">{r.reported_username || r.reported_name}</div>
                                    <a href={`/users/${r.reported_username}`} target="_blank" className="text-xs text-blue-500 hover:underline">View Profile &rarr;</a>
                                </div>

                                <div className="pt-4 border-t-2 border-black/20 dark:border-white/20">
                                    <h4 className="font-bold text-xs uppercase text-muted-foreground mb-1">Reported By</h4>
                                    <div className="font-bold">{r.reporter_username || r.reporter_name}</div>
                                    <a href={`/users/${r.reporter_username}`} target="_blank" className="text-xs text-blue-500 hover:underline">View Profile &rarr;</a>
                                </div>
                            </div>
                        </div>
                    ))}

                    {reports.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                            The moderation queue is empty.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
