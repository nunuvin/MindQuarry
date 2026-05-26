import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { applyQueryVote } from "@/lib/votes";

import { SearchResultsClient } from "./SearchResultsClient";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const resolvedParams = await searchParams;
    const query = resolvedParams.q || "";

    async function voteQuery(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) {
            return;
        }

        const queryId = formData.get("query_id") as string;
        const value = Number(formData.get("value"));
        if (!queryId || (value !== 1 && value !== -1)) {
            return;
        }

        await applyQueryVote(queryId, session.user.id, value);
        revalidatePath("/search");
    }

    return (
        <div className="page-shell max-w-6xl">
            <div className="soft-panel p-6 sm:p-8">
                <div className="flex flex-col gap-3 border-b border-border/70 pb-6">
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Search</p>
                    <h1 className="font-display text-3xl font-semibold tracking-tight">Find quarries, queries, and people</h1>
                    <p className="max-w-3xl text-sm leading-7 text-muted-foreground">Use <span className="font-semibold text-foreground">u:</span> for users, <span className="font-semibold text-foreground">q:</span> for quarries, and <span className="font-semibold text-foreground">p:</span> or <span className="font-semibold text-foreground">query:</span> for queries.</p>
                </div>

                <form action="/search" method="GET" className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        className="h-12 flex-1 rounded-full border border-border/70 bg-card px-5 text-sm font-medium outline-none transition focus:ring-2 focus:ring-sky-500 sm:text-base"
                        placeholder="Search queries, quarries, or users"
                    />
                    <button type="submit" className="soft-button-primary justify-center rounded-full px-6 py-3">
                        Search
                    </button>
                </form>

                <div className="mt-8">
                    <SearchResultsClient initialQuery={query} voteQueryAction={voteQuery} />
                </div>
            </div>
        </div>
    );
}
