"use client";
import Link from "next/link";
import { MessageSquare, Users, Settings, Search, LayoutDashboard, Flag } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
    { name: "Feed", href: "/", icon: LayoutDashboard },
    { name: "Communities", href: "/q", icon: Users },
    { name: "Messages", href: "/messages", icon: MessageSquare },
];

const adminLinks = [
    { name: "Settings", href: "/admin", icon: Settings },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Reports", href: "/admin/reports", icon: Flag },
]

export default function Sidebar({ isGlobalAdmin = false }: { isGlobalAdmin?: boolean }) {
    const pathname = usePathname();

    return (
        <aside className="w-64 border-r bg-muted/30 p-6 flex flex-col min-h-screen">
            <nav className="space-y-6 flex-1">
                <div>
                    <h4 className="font-bold text-xs uppercase text-muted-foreground mb-4">Discovery</h4>
                    <div className="space-y-2">
                        {links.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                            return (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                                        isActive ? "bg-black text-white dark:bg-white dark:text-black font-bold" : "hover:bg-muted"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {link.name}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {isGlobalAdmin && (
                    <div>
                        <h4 className="font-bold text-xs uppercase text-muted-foreground mb-4">Administration</h4>
                        <div className="space-y-2">
                            {adminLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.name}
                                        href={link.href}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-red-600 dark:text-red-400 font-bold",
                                            isActive ? "bg-red-100 dark:bg-red-950/50" : "hover:bg-red-50 dark:hover:bg-red-950/30"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {link.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </nav>
        </aside>
    );
}
