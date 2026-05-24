"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const COOKIE_NOTICE_DISMISS_KEY = "mq.cookie.notice.dismissed";

export default function CookieNotice({ enabled, message }: { enabled: boolean; message: string }) {
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        if (!enabled) {
            setDismissed(true);
            return;
        }

        const storedValue = window.localStorage.getItem(COOKIE_NOTICE_DISMISS_KEY);
        setDismissed(storedValue === "true");
    }, [enabled]);

    const dismissNotice = () => {
        window.localStorage.setItem(COOKIE_NOTICE_DISMISS_KEY, "true");
        setDismissed(true);
    };

    if (!enabled || dismissed) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl">
            <div className="soft-panel flex items-start justify-between gap-4 p-4 sm:p-5">
                <div>
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">Cookies</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{message}</p>
                </div>
                <button
                    type="button"
                    onClick={dismissNotice}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition hover:border-sky-400/70 hover:text-foreground"
                    aria-label="Dismiss cookie notice"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
