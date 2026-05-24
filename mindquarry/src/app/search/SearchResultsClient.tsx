"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { getRichTextPreview } from "@/lib/utils";
import type { SearchPage, SearchQueryResult, SearchQuarryResult, SearchResponse, SearchScope, SearchUserResult } from "@/lib/search";

type SearchResultsClientProps = {
    initialQuery: string;
};

type SearchState = SearchResponse | null;

async function fetchSearchResults(query: string, mode: "initial" | "more", section?: "users" | "quarries" | "queries", offset = 0) {
    const params = new URLSearchParams({ q: query, mode });

    if (section) {
        params.set("section", section);
        params.set("offset", String(offset));
    }

    const response = await fetch(`/api/search?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(response.status === 429 ? "Search is temporarily rate limited." : "Failed to load search results.");
    }

    return response.json() as Promise<SearchResponse>;
}

function mergePage<T>(current: SearchPage<T>, incoming: SearchPage<T>) {
    return {
        items: [...current.items, ...incoming.items],
        nextOffset: incoming.nextOffset,
    } satisfies SearchPage<T>;
}

function hasAnyResults(state: SearchResponse | null) {
    return Boolean(state && (state.users.items.length > 0 || state.quarries.items.length > 0 || state.queries.items.length > 0));
}

export function SearchResultsClient({ initialQuery }: SearchResultsClientProps) {
    const [results, setResults] = useState<SearchState>(null);
    const [isLoadingInitial, setIsLoadingInitial] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingQuarries, setIsLoadingQuarries] = useState(false);
    const [isLoadingQueries, setIsLoadingQueries] = useState(false);
    const [error, setError] = useState("");
    const querySentinelRef = useRef<HTMLDivElement | null>(null);

    const trimmedQuery = useMemo(() => initialQuery.trim(), [initialQuery]);

    useEffect(() => {
        let isActive = true;

        if (!trimmedQuery) {
            setResults(null);
            setError("");
            return;
        }

        setIsLoadingInitial(true);
        setError("");

        fetchSearchResults(trimmedQuery, "initial")
            .then((payload) => {
                if (isActive) {
                    setResults(payload);
                }
            })
            .catch((nextError: Error) => {
                if (isActive) {
                    setResults(null);
                    setError(nextError.message);
                }
            })
            .finally(() => {
                if (isActive) {
                    setIsLoadingInitial(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [trimmedQuery]);

    useEffect(() => {
        if (!trimmedQuery || !results || results.scope === "users" || results.scope === "quarries") {
            return;
        }

        if (!results.queries.nextOffset || isLoadingQueries) {
            return;
        }

        const sentinel = querySentinelRef.current;
        if (!sentinel) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (!entry?.isIntersecting) {
                return;
            }

            setIsLoadingQueries(true);
            fetchSearchResults(trimmedQuery, "more", "queries", results.queries.nextOffset || 0)
                .then((payload) => {
                    setResults((currentResults) => {
                        if (!currentResults) {
                            return payload;
                        }

                        return {
                            ...currentResults,
                            queries: mergePage(currentResults.queries, payload.queries),
                        };
                    });
                })
                .catch((nextError: Error) => {
                    setError(nextError.message);
                })
                .finally(() => {
                    setIsLoadingQueries(false);
                });
        }, { rootMargin: "240px" });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [trimmedQuery, results, isLoadingQueries]);

    const loadMore = async (section: "users" | "quarries") => {
        if (!results) {
            return;
        }

        const target = results[section];
        if (!target.nextOffset) {
            return;
        }

        if (section === "users") {
            setIsLoadingUsers(true);
        } else {
            setIsLoadingQuarries(true);
        }

        try {
            const payload = await fetchSearchResults(trimmedQuery, "more", section, target.nextOffset);
            setResults((currentResults) => {
                if (!currentResults) {
                    return payload;
                }

                if (section === "users") {
                    return {
                        ...currentResults,
                        users: mergePage(currentResults.users, payload.users),
                    };
                }

                return {
                    ...currentResults,
                    quarries: mergePage(currentResults.quarries, payload.quarries),
                };
            });
        } catch (nextError) {
            setError((nextError as Error).message);
        } finally {
            if (section === "users") {
                setIsLoadingUsers(false);
            } else {
                setIsLoadingQuarries(false);
            }
        }
    };

    const scope = (results?.scope || "all") satisfies SearchScope;
    const showUsers = scope === "all" || scope === "users";
    const showQuarries = scope === "all" || scope === "quarries";
    const showQueries = scope === "all" || scope === "queries";

    if (!trimmedQuery) {
        return (
            <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                Enter a term to search the platform.
            </div>
        );
    }

    if (isLoadingInitial) {
        return <div className="p-12 text-center font-bold text-muted-foreground">Loading search results...</div>;
    }

    return (
        <div className="space-y-8">
            {error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

            {showQuarries && results && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="font-black uppercase text-muted-foreground">Quarries</h2>
                        {results.quarries.nextOffset && (
                            <button type="button" onClick={() => loadMore("quarries")} disabled={isLoadingQuarries} className="text-sm font-bold text-sky-600 hover:underline disabled:opacity-60">
                                {isLoadingQuarries ? "Loading..." : "Show 5 more"}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.quarries.items.map((quarry: SearchQuarryResult) => (
                            <Link href={`/q/${quarry.name}`} key={quarry.id} className="p-4 border-2 border-black dark:border-white bg-card shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] hover:-translate-y-1 transition-transform">
                                <h3 className="font-bold text-lg text-blue-500">q/{quarry.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">{quarry.description}</p>
                            </Link>
                        ))}
                        {results.quarries.items.length === 0 && <p className="text-sm font-semibold text-muted-foreground">No matching quarries.</p>}
                    </div>
                </section>
            )}

            {showUsers && results && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="font-black uppercase text-muted-foreground">Users</h2>
                        {results.users.nextOffset && (
                            <button type="button" onClick={() => loadMore("users")} disabled={isLoadingUsers} className="text-sm font-bold text-sky-600 hover:underline disabled:opacity-60">
                                {isLoadingUsers ? "Loading..." : "Show 5 more"}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.users.items.map((user: SearchUserResult) => {
                            const href = user.username ? `/users/${encodeURIComponent(user.username)}` : "/settings";
                            return (
                                <Link href={href} key={user.id} className="soft-card p-5">
                                    <p className="font-display text-lg font-semibold tracking-tight">{user.displayUsername || user.username || user.name}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">@{user.username || user.id}</p>
                                    {user.name && <p className="mt-1 text-sm text-muted-foreground">{user.name}</p>}
                                </Link>
                            );
                        })}
                        {results.users.items.length === 0 && <p className="text-sm font-semibold text-muted-foreground">No matching users.</p>}
                    </div>
                </section>
            )}

            {showQueries && results && (
                <section className="space-y-6">
                    <h2 className="font-black uppercase text-muted-foreground">Threads</h2>
                    {results.queries.items.map((query: SearchQueryResult) => (
                        <article key={query.id} className="p-4 border-[3px] border-black dark:border-white flex gap-4 bg-card">
                            <div className="flex flex-col items-center justify-start min-w-[60px] p-2 bg-muted/30">
                                <span className="font-black text-lg">{query.score}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold mb-1 text-blue-500">q/{query.quarry_name}</div>
                                <Link href={`/q/${query.quarry_name}/query/${query.id}`} className="text-xl font-bold hover:underline mb-2 block line-clamp-2">
                                    {query.title}
                                </Link>
                                <p className="text-muted-foreground line-clamp-4 text-sm mb-4 break-words">
                                    {getRichTextPreview(query.body || query.answer_match_preview || "") || "No details provided."}
                                </p>
                                <p className="text-xs font-semibold text-muted-foreground">
                                    {query.answer_match_preview ? "Matched in an answer or reply" : "Matched in the thread body"}
                                </p>
                            </div>
                        </article>
                    ))}
                    {results.queries.items.length === 0 && !hasAnyResults(results) && (
                        <div className="p-12 text-center border-2 border-dashed border-muted-foreground font-bold text-muted-foreground">
                            No results found for <span className="font-semibold">{trimmedQuery}</span>.
                        </div>
                    )}
                    {results.queries.items.length > 0 && <div ref={querySentinelRef} className="h-1" />}
                    {isLoadingQueries && <p className="text-center text-sm font-semibold text-muted-foreground">Loading more threads...</p>}
                </section>
            )}
        </div>
    );
}