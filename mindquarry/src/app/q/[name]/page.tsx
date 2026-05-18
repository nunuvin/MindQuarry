import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function QuarryPage({ params }: { params: Promise<{ name: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    if (quarry.is_invite_only) {
        if (!session?.user) redirect("/login");
        const membership = await db.selectFrom("quarry_members").where("quarry_id", "=", quarry.id).where("user_id", "=", session!.user.id).executeTakeFirst();
        if (!membership) {
            return (
                <div className="max-w-4xl mx-auto mt-12 p-12 text-center border-2 border-black dark:border-white">
                    <h1 className="text-2xl font-black uppercase mb-4 text-red-500">Private Community</h1>
                    <p>This Quarry is invite-only. You must be added by an admin to view its contents or participate.</p>
                </div>
            );
        }
    }

    const queries = await db.selectFrom("queries")
        .leftJoin("user", "user.id", "queries.user_id")
        .select([
            "queries.id", "queries.title", "queries.body", "queries.score", "queries.views",
            "queries.accepted_answer_id", "queries.created_at", "user.name", "user.displayUsername", "user.username"
        ])
        .where("quarry_id", "=", quarry.id)
        .where("is_hidden", "=", false)
        .orderBy("created_at", "desc")
        .execute();

    return (
        <div className="max-w-4xl mx-auto mt-8 p-4">
            <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-950 border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tight">q/{quarry.name}</h1>
                        <p className="mt-2 text-lg">{quarry.description}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                        {session?.user && (
                            <Link href={`/q/${quarry.name}/submit`} className="px-6 py-3 font-bold border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition-colors cursor-pointer shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] whitespace-nowrap">
                                Submit Query
                            </Link>
                        )}
                        {session?.user && (
                            <Link href={`/q/${quarry.name}/settings`} className="text-sm font-bold text-muted-foreground hover:underline mt-2">
                                Mod Settings
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {queries.map(q => (
                    <div key={q.id} className="p-4 border-2 border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] flex gap-4 bg-card transition-all hover:translate-y-1 hover:shadow-none relative">
                        {q.score !== null && q.score <= -5 && (
                            <div className="absolute inset-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center justify-center font-bold text-red-600">
                                Content minimized due to low score. Click to reveal.
                            </div>
                        )}
                        <div className="flex flex-col items-center justify-start min-w-[60px] p-2 bg-muted/30">
                            <span className="font-black text-lg">{q.score}</span>
                            <span className="text-xs uppercase font-bold text-muted-foreground">Votes</span>
                            {q.accepted_answer_id && (
                                <div className="mt-2 text-green-500 font-bold border-2 border-green-500 px-1 py-0.5 text-xs">
                                    ✓
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <Link href={`/q/${quarry.name}/query/${q.id}`} className="text-xl font-bold hover:underline mb-2 block">
                                {q.title}
                            </Link>
                            <p className="text-muted-foreground line-clamp-2 text-sm mb-4">
                                {q.body}
                            </p>
                            <div className="flex justify-between items-center text-xs text-muted-foreground font-bold">
                                <span>{q.views} views</span>
                                <span>Asked by {q.displayUsername || q.username || q.name} on {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {queries.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                        No queries here yet. Be the first to ask!
                    </div>
                )}
            </div>
        </div>
    );
}
