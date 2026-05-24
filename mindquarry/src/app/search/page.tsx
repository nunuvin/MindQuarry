import { SearchResultsClient } from "./SearchResultsClient";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const resolvedParams = await searchParams;
    const query = resolvedParams.q || "";

    return (
        <div className="max-w-6xl mx-auto mt-8 p-4">
            <h1 className="text-3xl font-black uppercase tracking-tight mb-8 border-b-[3px] border-black dark:border-white pb-2">Search Results</h1>

            <form action="/search" method="GET" className="mb-4 flex gap-4">
                <input
                    type="search"
                    name="q"
                    defaultValue={query}
                    className="flex-1 p-4 border-[3px] border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                    placeholder="Search queries, quarries or users."
                />
                <button type="submit" className="px-8 bg-black text-white dark:bg-white dark:text-black font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none transition-all">
                    Search
                </button>
            </form>

            <p className="mb-8 text-sm font-semibold text-muted-foreground">Use <span className="text-foreground">u:</span> for users, <span className="text-foreground">q:</span> for quarries, or <span className="text-foreground">query:</span> for threads. Example: <span className="text-foreground">u: &quot;alice&quot;</span>.</p>

            <SearchResultsClient initialQuery={query} />
        </div>
    );
}
