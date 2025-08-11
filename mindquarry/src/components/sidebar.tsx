"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, User, Settings } from "lucide-react";
import ThemeSwitcher from "./theme-switcher";
import { cn } from "@/lib/utils";
import {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
    NavigationMenuLink,
} from "@/components/ui/navigation-menu";

const navItems = [
    { name: "Profile", icon: User, href: "#" },
    { name: "Settings", icon: Settings, href: "#" },
];

export default function Sidebar() {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <aside
            className={cn(
                "h-screen sticky top-0 border-r flex flex-col transition-[width] ease-in-out",
                isExpanded ? "duration-100 w-50" : "duration-50 w-20"
            )}
            aria-label="Sidebar navigation"
        >
            {/* Navigation with Chevron as first item */}
            <nav className="flex-grow w-full">
                <div className="w-full">
                    <NavigationMenu orientation="vertical" className="w-full flex flex-col">
                        <NavigationMenuList className="flex flex-col gap-1 w-full justify-start pt-3">
                            <NavigationMenuItem className="w-full">
                                <button
                                    onClick={() => setIsExpanded((v) => !v)}
                                    aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
                                    className={cn(
                                        "flex items-center w-full h-11 rounded-lg transition-colors group hover:bg-muted text-foreground px-4 border-b-0",
                                        !isExpanded && "justify-center"
                                    )}
                                    type="button"
                                >
                                    <div className="flex items-center justify-center h-9 w-9 rounded-md border">
                                        {isExpanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                    </div>
                                </button>
                            </NavigationMenuItem>
                            {navItems.map((item) => (
                                <NavigationMenuItem key={item.name} className="w-full">
                                    <NavigationMenuLink href={item.href} className="block w-full">
                                        <div
                                            className={cn(
                                                "flex items-center w-full h-11 rounded-lg transition-colors group sidebar-nav-item",
                                                isExpanded ? "px-4" : "justify-center",
                                                "text-foreground"
                                            )}
                                        >
                                            {isExpanded ? (
                                                <>
                                                    <span
                                                        className={cn(
                                                            "text-sm font-medium whitespace-nowrap text-left",
                                                            "transition-all duration-300 ease-in-out",
                                                            "flex-1",
                                                            "opacity-100 translate-x-0"
                                                        )}
                                                    >
                                                        {item.name}
                                                    </span>
                                                    <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-md border ml-2">
                                                        <item.icon className="h-5 w-5 text-zinc-700 dark:text-zinc-400" />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex items-center justify-center w-full">
                                                    <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-md border">
                                                        <item.icon className="h-5 w-5 text-zinc-700 dark:text-zinc-400" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </NavigationMenuLink>
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>
            </nav>
            {/* Theme Switcher above the logo area */}
            <div className="flex flex-col items-center w-full">
                <ThemeSwitcher />
            </div>
            {/* Logo area (keep empty or add logo if needed) */}
            <div className="flex flex-col items-center mb-32">
                {/* Place Next.js logo here if needed */}
            </div>
        </aside>
    );
}