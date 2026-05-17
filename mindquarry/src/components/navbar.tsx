"use client";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { SearchIcon, CornerDownLeft } from "lucide-react";
import UserMenu from "./user-menu";
import { useEffect, useState } from "react";

export default function Navbar() {
    const [user, setUser] = useState<any>(null);
    useEffect(() => {
        let unsub: any;
        (async () => {
            unsub = authClient.session.subscribe((session) => {
                setUser(session?.user || null);
            });
            // Fetch session on mount
            const session = await authClient.session.get();
            setUser(session?.user || null);
        })();
        return () => { if (unsub) unsub(); };
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