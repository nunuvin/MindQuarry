import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getQuarryVisibility } from "@/lib/visibility";

export default async function QuarriesIndex() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    const settings = await getSiteSettings();
    const [quarries, memberships] = await Promise.all([
        db.selectFrom("quarries").selectAll().orderBy("created_at", "desc").execute(),
        session?.user
            ? db.selectFrom("quarry_members").select("quarry_id").where("user_id", "=", session.user.id).execute()
            : Promise.resolve([]),
    ]);

    const memberQuarryIds = new Set(memberships.map((membership) => membership.quarry_id));
    const visibleQuarries = quarries.filter((quarry) => {
        const visibility = getQuarryVisibility(quarry);

        if (visibility === "public") {
            return true;
        }

        if (visibility === "authenticated") {
            return Boolean(session?.user);
        }

        return memberQuarryIds.has(quarry.id);
    });

    return (
        <div className="page-shell">
            <section className="soft-panel p-6 sm:p-8">
                <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Communities</p>
                        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">Communities</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Browse public quarries, scan descriptions faster, and jump into the ones you want to follow or moderate.</p>
                    </div>
                    {!settings?.simplified_mode_enabled && (
                        <Link href="/q/new" className="soft-button-primary justify-center px-5 py-3">
                            Create Quarry
                        </Link>
                    )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {visibleQuarries.map(quarry => (
                        <Link href={`/q/${quarry.name}`} key={quarry.id} className="soft-card block p-6">
                            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
                                <span>Community</span>
                                <span className="rounded-full border border-border/70 px-2 py-1 text-[10px] text-muted-foreground">
                                    {getQuarryVisibility(quarry) === "members" ? "Private" : getQuarryVisibility(quarry) === "authenticated" ? "Members" : "Public"}
                                </span>
                            </div>
                            <h2 className="mt-3 text-2xl font-semibold tracking-tight">q/{quarry.name}</h2>
                            <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">{quarry.description || "No description provided."}</p>
                        </Link>
                    ))}

                    {visibleQuarries.length === 0 && (
                        <div className="col-span-full rounded-[20px] border border-dashed border-border/80 bg-card/50 p-12 text-center text-muted-foreground">
                            <p className="text-lg font-semibold">No communities have been created yet.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
