import { db } from "@/lib/db";
import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";

export default async function Home() {
    const settings = await getSiteSettings();

    // Fetch the main feed logic (recently active / top scored depending on how complex we want this to be initially)
    // For now, let's fetch the most recent non-hidden queries globally.
    const queries = await db.selectFrom("queries")
        .leftJoin("user", "user.id", "queries.user_id")
        .leftJoin("quarries", "quarries.id", "queries.quarry_id")
        .select([
            "queries.id", "queries.title", "queries.body", "queries.score", "queries.views",
            "queries.accepted_answer_id", "queries.created_at", "user.name", "user.displayUsername", "user.username",
            "quarries.name as quarry_name"
        ])
        .where("queries.is_hidden", "=", false)
        .orderBy("queries.created_at", "desc")
        .limit(20)
        .execute();

    return (
        <div className="max-w-5xl mx-auto mt-8 p-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-3 space-y-6">
                <div className="flex items-center justify-between border-b-[3px] border-black dark:border-white pb-2 mb-6">
                    <h1 className="text-3xl font-black uppercase tracking-tight">Main Feed</h1>
                    <div className="flex gap-2">
                        <span className="font-bold border-2 border-black dark:border-white px-3 py-1 bg-black text-white dark:bg-white dark:text-black">New</span>
                        <span className="font-bold border-2 border-black dark:border-white px-3 py-1 cursor-not-allowed opacity-50">Top</span>
                    </div>
                </div>

                {queries.map(q => (
                    <div key={q.id} className="p-4 border-[3px] border-black dark:border-white shadow-[6px_6px_0_0_#000] dark:shadow-[6px_6px_0_0_#fff] flex gap-4 bg-card transition-all hover:translate-y-1 hover:shadow-[4px_4px_0_0_#000] dark:hover:shadow-[4px_4px_0_0_#fff] relative">
                        {q.score !== null && q.score <= -5 && (
                            <div className="absolute inset-0 bg-muted/90 backdrop-blur-sm z-10 flex items-center justify-center font-bold text-red-600">
                                Hidden due to low score.
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
                            <div className="text-xs font-bold mb-1 text-blue-500 hover:underline">
                                <Link href={`/q/${q.quarry_name}`}>q/{q.quarry_name}</Link>
                            </div>
                            <Link href={`/q/${q.quarry_name}/query/${q.id}`} className="text-xl font-bold hover:underline mb-2 block line-clamp-2">
                                {q.title}
                            </Link>
                            <p className="text-muted-foreground line-clamp-2 text-sm mb-4">
                                {q.body}
                            </p>
                            <div className="flex justify-between items-center text-xs text-muted-foreground font-bold border-t-2 border-black/10 dark:border-white/10 pt-2">
                                <span>{q.views} views</span>
                                <span>Asked by {q.displayUsername || q.username || q.name} on {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {queries.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                        The feed is empty.
                    </div>
                )}
            </div>

            <div className="space-y-8 hidden md:block">
                <div className="p-6 bg-blue-50 dark:bg-blue-950 border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                    <h2 className="font-black uppercase mb-4 text-xl border-b-2 border-black dark:border-white pb-2">MindQuarry</h2>
                    <p className="text-sm font-medium mb-4">A community-driven Q&A platform bridging structured reputation with dynamic subforums.</p>
                    <Link href="/q" className="block text-center w-full py-2 bg-black text-white dark:bg-white dark:text-black font-bold border-2 border-black dark:border-white hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition-colors cursor-pointer">
                        Explore Quarries
                    </Link>
                </div>
            </div>
        </div>
    );
}
