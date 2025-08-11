"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ThemeSwitcher() {
    const [theme, setTheme] = useState<"light" | "dark">("light");
    // Detect system theme on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const isDark = document.documentElement.classList.contains("dark") ||
                window.matchMedia("(prefers-color-scheme: dark)").matches;
            setTheme(isDark ? "dark" : "light");
        }
    }, []);

    // Toggle theme
    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    };
    // Icon button: no border, no extra background, icon only
    const iconButton =
        "h-9 w-9 flex items-center justify-center p-0 rounded-full transition-colors duration-200 border";

    // No hover background or color change
    const sidebarHighlight = "";

    return (
        <button
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className={cn(
                iconButton,
                "theme-switcher-btn focus:outline-none focus:ring-2 focus:ring-ring group",
                sidebarHighlight,
                theme === "light"
                    ? "bg-neutral-900 border-neutral-900"
                    : "bg-neutral-100 border-neutral-100"
            )}
            type="button"
        >
            {theme === "light" ? (
                <Moon
                    className={cn(
                        "h-5 w-5 text-white transition-colors duration-200",
                        "stroke-white fill-none"
                    )}
                />
            ) : (
                <Sun
                    className={cn(
                        "h-5 w-5 text-black transition-colors duration-200"
                    )}
                />
            )}
        </button>
    );

}
