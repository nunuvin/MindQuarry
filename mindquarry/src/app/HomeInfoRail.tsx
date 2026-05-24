"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const HOME_INFO_DISMISS_KEY = "mq.home.info.dismissed";

export default function HomeInfoRail() {
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const storedValue = window.localStorage.getItem(HOME_INFO_DISMISS_KEY);
        setDismissed(storedValue === "true");
    }, []);

    const dismissCard = () => {
        window.localStorage.setItem(HOME_INFO_DISMISS_KEY, "true");
        setDismissed(true);
    };

    if (dismissed) {
        return null;
    }

    return (
        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <section className="soft-panel p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">MindQuarry</p>
                        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight">MindQuarry</h2>
                    </div>
                    <button
                        type="button"
                        onClick={dismissCard}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition hover:border-sky-400/70 hover:text-foreground"
                        aria-label="Dismiss MindQuarry introduction"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">A community-driven Q&amp;A platform for searchable threads, followable communities, messaging, and moderation workflows.</p>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl border border-border/70 bg-card px-3 py-4">
                        <div className="text-lg font-semibold">Feed</div>
                        <div className="text-xs text-muted-foreground">Score-aware</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card px-3 py-4">
                        <div className="text-lg font-semibold">Chat</div>
                        <div className="text-xs text-muted-foreground">Rich text</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card px-3 py-4">
                        <div className="text-lg font-semibold">Mod</div>
                        <div className="text-xs text-muted-foreground">Reports</div>
                    </div>
                </div>
                <Link href="/q" className="soft-button-primary mt-6 w-full justify-center py-3">
                    Explore Quarries
                </Link>
            </section>
        </aside>
    );
}
