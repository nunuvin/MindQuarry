"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Users, Settings, LayoutDashboard, Flag, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "mq.sidebar.collapsed";
const SIDEBAR_NAVBAR_OFFSET_PX = 73;

const links = [
    { name: "Feed", href: "/", icon: LayoutDashboard },
    { name: "Communities", href: "/q", icon: Users },
    { name: "Messages", href: "/messages", icon: MessageSquare },
];

const adminLinks = [
    { name: "Settings", href: "/admin", icon: Settings },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Reports", href: "/admin/reports", icon: Flag },
];

export default function Sidebar({ isGlobalAdmin = false }: { isGlobalAdmin?: boolean }) {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const storedValue = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
        setIsCollapsed(storedValue === "true");
    }, []);

    const toggleSidebar = () => {
        const nextValue = !isCollapsed;
        window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(nextValue));
        setIsCollapsed(nextValue);
    };

    return (
        <aside className={cn(
            "sticky hidden shrink-0 border-r border-border/70 bg-card md:block",
            isCollapsed ? "w-20" : "w-72"
        )} style={{ top: `${SIDEBAR_NAVBAR_OFFSET_PX}px`, height: `calc(100vh - ${SIDEBAR_NAVBAR_OFFSET_PX}px)` }}>
            <div className={cn("flex h-full flex-col py-6", isCollapsed ? "px-3" : "px-5")}>
                <div className="mb-6 flex items-center justify-between gap-3">
                    {!isCollapsed && <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Navigation</p>}
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition hover:border-sky-400/70 hover:text-foreground"
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                    </button>
                </div>
                <nav className="flex-1 space-y-8">
                    <div>
                        {!isCollapsed && <h4 className="font-display mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Discovery</h4>}
                        <div className="space-y-2">
                            {links.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));

                                return (
                                    <Link
                                        key={link.name}
                                        href={link.href}
                                        title={isCollapsed ? link.name : undefined}
                                        className={cn(
                                            "group flex rounded-2xl py-3 text-sm font-semibold text-foreground/80 transition-all duration-200",
                                            isCollapsed ? "justify-center px-3" : "items-center gap-3 px-4",
                                            isActive
                                                ? "bg-gradient-to-r from-sky-500/15 via-sky-500/10 to-transparent text-foreground shadow-[inset_0_0_0_1px_rgba(56,189,248,0.25),0_14px_30px_-24px_rgba(14,165,233,0.75)]"
                                                : "hover:bg-muted/60 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4 transition-transform duration-200", isActive ? "text-sky-500" : "group-hover:-translate-y-0.5 group-hover:text-sky-500")} />
                                        {!isCollapsed && link.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {isGlobalAdmin && (
                        <div>
                            {!isCollapsed && <h4 className="font-display mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Administration</h4>}
                            <div className="space-y-2">
                                {adminLinks.map((link) => {
                                    const Icon = link.icon;
                                    const isActive = pathname === link.href;

                                    return (
                                        <Link
                                            key={link.name}
                                            href={link.href}
                                            title={isCollapsed ? link.name : undefined}
                                            className={cn(
                                                "group flex rounded-2xl py-3 text-sm font-semibold text-red-600 transition-all duration-200 dark:text-red-400",
                                                isCollapsed ? "justify-center px-3" : "items-center gap-3 px-4",
                                                isActive
                                                    ? "bg-red-500/10 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.22)]"
                                                    : "hover:bg-red-500/6"
                                            )}
                                        >
                                            <Icon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
                                            {!isCollapsed && link.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </nav>

                {!isCollapsed && (
                    <div className="soft-panel p-4">
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Today</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">Track communities, chats, and moderation from one place without losing the quick navigation you already liked.</p>
                    </div>
                )}
            </div>
        </aside>
    );
}
