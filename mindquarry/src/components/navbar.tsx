"use client";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { SearchIcon, CornerDownLeft } from "lucide-react";
import UserMenu from "./user-menu";
import { useEffect, useState } from "react";

export default function Navbar() {
    const [user, setUser] = useState<any>(null);
    useEffect(() => {
        let unsubSignal: any;
        let mounted = true;
        const isDev = process.env.NODE_ENV !== "production";

        const fetchSession = async () => {
            try {
                const result = await (authClient as any)["get-session"]();
                const resolvedUser = result?.data?.user ?? result?.user ?? null;

                if (isDev) {
                    console.debug("[auth] navbar get-session", {
                        hasData: Boolean(result?.data),
                        hasUser: Boolean(resolvedUser),
                        username: resolvedUser?.username ?? resolvedUser?.displayUsername ?? null,
                    });
                }

                if (mounted) setUser(resolvedUser);
            } catch (e) {
                if (isDev) {
                    console.debug("[auth] navbar get-session failed", e);
                }
                if (mounted) setUser(null);
            }
        };

        // Initial fetch
        fetchSession();

        // If the client exposes the $sessionSignal atom, subscribe to it so UI updates after sign-in/out
        try {
            const atoms = (authClient as any).$store?.atoms;
            const signal = atoms?.$sessionSignal;
            if (signal && typeof signal.subscribe === "function") {
                unsubSignal = signal.subscribe(() => {
                    if (isDev) {
                        console.debug("[auth] session signal toggled");
                    }
                    fetchSession();
                });
            } else if (isDev) {
                console.debug("[auth] no session signal available on auth client");
            }
        } catch (e) {
            if (isDev) {
                console.debug("[auth] session signal subscribe failed", e);
            }
        }

        return () => {
            mounted = false;
            if (typeof unsubSignal === "function") unsubSignal();
        };
    }, []);

    return (
        <nav className="sticky top-0 z-50 shadow-3xs flex items-center justify-between p-4 border-b">
            <div><a href="/">MindQuarry</a></div>

            <div className="flex-grow px-16">
                <div className="relative flex items-center">
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <div className="absolute left-8 top-2.5 h-5 w-px bg-muted-foreground opacity-50" />
                    <Input
                        type="search"
                        placeholder="Search..."
                        className="pl-10 pr-10"
                    />
                    <div className="absolute right-8 top-2.5 h-5 w-px bg-muted-foreground opacity-50" />
                    <CornerDownLeft className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            <div className="ml-auto pr-4">
                <UserMenu user={user} />
            </div>
        </nav>
    );
}