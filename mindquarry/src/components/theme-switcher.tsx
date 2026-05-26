"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ThemeSwitcher() {
    const [theme, setTheme] = useState<"light" | "dark">("light");
    // Detect system theme on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const prefersDark = typeof window.matchMedia === "function"
                ? window.matchMedia("(prefers-color-scheme: dark)").matches
                : false;
            const isDark = document.documentElement.classList.contains("dark") ||
                prefersDark;
            setTheme(isDark ? "dark" : "light");
        }
    }, []);

    // Toggle theme
    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        window.localStorage.setItem("mq.theme", newTheme);
        if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    };

    return (
        <button
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className={cn(
                "flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:border-sky-400/60 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
            )}
            type="button"
        >
            <span>{theme === "light" ? "Use dark theme" : "Use light theme"}</span>
            <span className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 transition",
                theme === "light" ? "bg-neutral-950 text-white" : "bg-white text-neutral-900"
            )}>
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </span>
        </button>
    );

}
