import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import Link from "next/link";

export default async function QuarriesIndex() {
    const settings = await getSiteSettings();
    const quarries = await db.selectFrom("quarries").selectAll().orderBy("created_at", "desc").execute();

    return (
        <div className="max-w-4xl mx-auto mt-12 p-6">
            <div className="flex items-center justify-between mb-8 border-b-[3px] border-black dark:border-white pb-2">
                <h1 className="text-3xl font-black uppercase">Communities</h1>
                {!settings?.simplified_mode_enabled && (
                    <Link href="/q/new" className="px-4 py-2 font-bold border-[3px] border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                        Create Quarry
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quarries.map(quarry => (
                    <Link href={`/q/${quarry.name}`} key={quarry.id} className="block p-6 border-[3px] border-black dark:border-white shadow-[6px_6px_0_0_#000] dark:shadow-[6px_6px_0_0_#fff] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[4px_4px_0_0_#000] dark:hover:shadow-[4px_4px_0_0_#fff] transition-all bg-card">
                        <h2 className="text-xl font-bold mb-2">q/{quarry.name}</h2>
                        <p className="text-muted-foreground line-clamp-3">{quarry.description || "No description provided."}</p>
                    </Link>
                ))}

                {quarries.length === 0 && (
                    <div className="col-span-full p-12 text-center border-2 border-dashed border-muted-foreground">
                        <p className="text-lg text-muted-foreground font-bold">No communities have been created yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
