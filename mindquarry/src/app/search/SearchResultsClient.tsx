"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { VoteControls } from "@/components/vote-controls";
import { getRichTextPreview } from "@/lib/utils";
import type { SearchPage, SearchQueryResult, SearchQuarryResult, SearchResponse, SearchScope, SearchUserResult } from "@/lib/search";

type SearchResultsClientProps = {
    initialQuery: string;
    voteQueryAction?: (formData: FormData) => void | Promise<void>;
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

const ACCESS_DECORATION: Record<string, { card: string; label: string; badge: string; badgeClassName: string }> = {
    public: {
        card: "border-zinc-400/70 bg-zinc-500/[0.035] shadow-[inset_0_0_0_1px_rgba(161,161,170,0.18)]",
        label: "Visible to everyone",
        badge: "Public",
        badgeClassName: "border-zinc-400/70 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
    },
    authenticated: {
        card: "border-slate-200 bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.92)] dark:border-slate-100/80 dark:bg-slate-50/5",
        label: "Visible to signed-in users",
        badge: "Signed-in",
        badgeClassName: "border-slate-300 bg-white text-slate-700 dark:border-slate-200/80 dark:bg-slate-100/10 dark:text-slate-100",
    },
    members: {
        card: "border-sky-500/80 bg-sky-500/[0.055] shadow-[inset_0_0_0_1px_rgba(14,165,233,0.34),0_10px_26px_-20px_rgba(14,165,233,0.85)]",
        label: "Visible by quarry membership",
        badge: "Members",
        badgeClassName: "border-sky-500/70 bg-sky-500/12 text-sky-700 dark:text-sky-300",
    },
    admin: {
        card: "border-red-500/80 bg-red-500/[0.05] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.4),0_10px_26px_-20px_rgba(239,68,68,0.9)]",
        label: "Visible because you are an instance admin",
        badge: "Admin Only",
        badgeClassName: "border-red-500/70 bg-red-500/12 text-red-700 dark:text-red-300",
    },
};

function getAccessDecoration(accessLevel: string) {
    return ACCESS_DECORATION[accessLevel] || ACCESS_DECORATION.public;
}

export function SearchResultsClient({ initialQuery, voteQueryAction }: SearchResultsClientProps) {
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
            <div className="rounded-[28px] border border-dashed border-border/80 bg-muted/20 p-12 text-center text-sm font-semibold text-muted-foreground">
                Enter a term to search the platform.
            </div>
        );
    }

    if (isLoadingInitial) {
        return <div className="rounded-[28px] border border-border/70 bg-muted/20 p-12 text-center text-sm font-semibold text-muted-foreground">Loading search results...</div>;
    }

    return (
        <div className="space-y-8">
            {error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

            {results && hasAnyResults(results) && (
                <div className="rounded-[24px] border border-border/70 bg-muted/20 px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <span className="mr-3">Edge legend</span>
                    <span className="mr-3 inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Everyone</span>
                    <span className="mr-3 inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-white ring-1 ring-zinc-300" /> Signed-in</span>
                    <span className="mr-3 inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Membership</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Admin</span>
                </div>
            )}

            {showQuarries && results && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Quarries</h2>
                        {results.quarries.nextOffset && (
                            <button type="button" onClick={() => loadMore("quarries")} disabled={isLoadingQuarries} className="text-sm font-semibold text-sky-600 hover:underline disabled:opacity-60">
                                {isLoadingQuarries ? "Loading..." : "Show 5 more"}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.quarries.items.map((quarry: SearchQuarryResult) => {
                            const decoration = getAccessDecoration(quarry.accessLevel);
                            return (
                                <Link href={`/q/${quarry.name}`} key={quarry.id} data-access-level={quarry.accessLevel} title={decoration.label} className={`soft-card p-5 transition-transform hover:-translate-y-0.5 ${decoration.card}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-display text-xl font-semibold tracking-tight text-sky-600 dark:text-sky-400">q/{quarry.name}</h3>
                                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${decoration.badgeClassName}`}>{decoration.badge}</span>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-2">{quarry.description}</p>
                                </Link>
                            );
                        })}
                        {results.quarries.items.length === 0 && <p className="text-sm font-semibold text-muted-foreground">No matching quarries.</p>}
                    </div>
                </section>
            )}

            {showUsers && results && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Users</h2>
                        {results.users.nextOffset && (
                            <button type="button" onClick={() => loadMore("users")} disabled={isLoadingUsers} className="text-sm font-semibold text-sky-600 hover:underline disabled:opacity-60">
                                {isLoadingUsers ? "Loading..." : "Show 5 more"}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.users.items.map((user: SearchUserResult) => {
                            const href = user.username ? `/users/${encodeURIComponent(user.username)}` : "/settings";
                            const decoration = getAccessDecoration(user.accessLevel);
                            return (
                                <Link href={href} key={user.id} data-access-level={user.accessLevel} title={decoration.label} className={`soft-card p-5 ${decoration.card}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="font-display text-lg font-semibold tracking-tight">{user.displayUsername || user.username || user.name}</p>
                                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${decoration.badgeClassName}`}>{decoration.badge}</span>
                                    </div>
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
                    <h2 className="font-display text-2xl font-semibold tracking-tight">Queries</h2>
                    {results.queries.items.map((query: SearchQueryResult) => {
                        const decoration = getAccessDecoration(query.accessLevel);
                        const preview = getRichTextPreview(query.body || query.answer_match_preview || "");
                        return (
                            <article key={query.id} data-access-level={query.accessLevel} title={decoration.label} className={`soft-card flex gap-4 p-5 ${decoration.card}`}>
                                <div className="flex min-w-[64px] flex-col items-center justify-start rounded-[20px] border border-border/70 bg-muted/30 p-3">
                                    {voteQueryAction ? (
                                        <VoteControls score={query.score} action={voteQueryAction} fields={{ query_id: query.id }} compact />
                                    ) : (
                                        <span className="text-lg font-semibold">{query.score}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">q/{query.quarry_name}</div>
                                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${decoration.badgeClassName}`}>{decoration.badge}</span>
                                    </div>
                                    <Link href={`/q/${query.quarry_name}/query/${query.id}`} className="mb-2 block font-display text-2xl font-semibold tracking-tight hover:underline line-clamp-2">
                                        {query.title}
                                    </Link>
                                    {preview && (
                                        <p className="mb-4 break-words text-sm leading-7 text-muted-foreground line-clamp-4">
                                            {preview}
                                        </p>
                                    )}
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        {query.answer_match_preview ? "Matched in an answer" : preview ? "Matched in the query body" : "Matched in the title"}
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                    {results.queries.items.length === 0 && !hasAnyResults(results) && (
                        <div className="rounded-[28px] border border-dashed border-border/80 bg-muted/20 p-12 text-center text-sm font-semibold text-muted-foreground">
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