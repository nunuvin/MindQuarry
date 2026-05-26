"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { SearchIcon, CornerDownLeft, Bell } from "lucide-react";
import UserMenu from "./user-menu";

export default function Navbar({
    notificationBadgeCap,
    notificationPollIntervalMs,
}: {
    notificationBadgeCap: number;
    notificationPollIntervalMs: number;
}) {
    const { data: session } = authClient.useSession();
    const user = session?.user ?? null;
    const pathname = usePathname();
    const [notificationCount, setNotificationCount] = useState(0);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    useEffect(() => {
        if (!user) {
            setNotificationCount(0);
            return;
        }

        let cancelled = false;

        const loadCount = async () => {
            try {
                const response = await fetch("/api/notifications/count", { cache: "no-store" });
                if (!response.ok) {
                    return;
                }

                const data = await response.json() as { count?: number };
                if (!cancelled) {
                    setNotificationCount(Number(data.count ?? 0));
                }
            } catch {
                if (!cancelled) {
                    setNotificationCount(0);
                }
            }
        };

        loadCount();
        const intervalId = window.setInterval(loadCount, notificationPollIntervalMs);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [notificationPollIntervalMs, pathname, user]);

    return (
        <nav className="sticky top-0 z-50 border-b border-border/70 bg-background shadow-sm">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
                <Link href="/" className="font-display text-xl font-semibold tracking-tight text-foreground transition-transform duration-200 hover:-translate-y-0.5">
                    MindQuarry
                </Link>

                <div className="mx-auto hidden max-w-3xl flex-1 md:block">
                    <form action="/search" method="GET" className="relative flex items-center overflow-hidden rounded-full border border-border/70 bg-card shadow-sm transition duration-200 focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]">
                        <SearchIcon className="absolute left-4 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <div className="absolute left-10 h-5 w-px bg-border/80" />
                        <Input
                            type="search"
                            name="q"
                            placeholder="Search quarries, queries, or users"
                            className="h-12 border-0 bg-transparent pl-14 pr-14 text-sm shadow-none focus-visible:ring-0 md:text-base"
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                        />
                        <button type="submit" className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground transition hover:border-sky-400/70 hover:text-foreground">
                            <CornerDownLeft className="h-4 w-4" />
                        </button>
                    </form>
                    {isSearchFocused && (
                        <p className="mt-2 pl-4 text-xs font-semibold text-muted-foreground">Use <span className="text-foreground">u:</span> for users, <span className="text-foreground">q:</span> for quarries, and <span className="text-foreground">p:</span> or <span className="text-foreground">query:</span> for queries.</p>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-3">
                    {user && (
                        <Link href="/notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground transition hover:border-sky-400/70 hover:text-foreground" aria-label="Notifications">
                            <Bell className="h-4 w-4" />
                            {notificationCount > 0 && (
                                <span className="absolute -right-1 -top-1 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                                    {notificationCount > notificationBadgeCap ? `${notificationBadgeCap}+` : notificationCount}
                                </span>
                            )}
                        </Link>
                    )}
                    <UserMenu user={user} />
                </div>
            </div>

            <div className="border-t border-border/60 px-4 pb-3 md:hidden">
                <form action="/search" method="GET" className="relative mt-3 flex items-center overflow-hidden rounded-full border border-border/70 bg-card shadow-sm transition duration-200 focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]">
                    <SearchIcon className="absolute left-4 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <div className="absolute left-10 h-5 w-px bg-border/80" />
                    <Input
                        type="search"
                        name="q"
                        placeholder="Search quarries, queries, or users"
                        className="h-11 border-0 bg-transparent pl-14 pr-14 text-sm shadow-none focus-visible:ring-0"
                    />
                    <button type="submit" className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground transition hover:border-sky-400/70 hover:text-foreground">
                        <CornerDownLeft className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </nav>
    );
}