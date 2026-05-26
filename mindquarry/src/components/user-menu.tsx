"use client";
import { useEffect, useRef, useState } from "react";
import { User as UserIcon, LogOut, Settings, ChevronDown, Bell, MessageSquareMore } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { useRouter } from "next/navigation";

type UserMenuUser = {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
    displayUsername?: string | null;
    role?: string | null;
};

export default function UserMenu({ user }: { user?: UserMenuUser | null }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [open]);

    const handleLogout = async () => {
        await authClient.signOut();
        setOpen(false);
        router.replace("/");
        router.refresh();
    };

    if (!user) {
        return (
            <div className="flex gap-2">
                <Link href="/login" className="soft-button">Sign in</Link>
                <Link href="/signup" className="soft-button-primary">Sign up</Link>
            </div>
        );
    }

    const username = user.displayUsername || user.username || user.name || user.email || "User";
    const profileSlug = user.username || user.displayUsername || user.email || user.id;
    const profileHref = profileSlug ? `/users/${encodeURIComponent(profileSlug)}` : "/settings";

    return (
        <div ref={menuRef} className="relative flex items-center">
            <Link href={profileHref} className="group flex items-center gap-3 rounded-full border border-border/70 bg-card px-2 py-1.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/60 hover:bg-card">
                <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-muted">
                    {user.image ? (
                        <Image src={user.image} alt="avatar" fill sizes="40px" className="object-cover" />
                    ) : (
                        <UserIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                </div>
                <span className="hidden text-sm font-semibold text-foreground sm:block">
                    {username}
                    {user.role === 'admin' && <span className="ml-2 text-xs text-red-500">admin</span>}
                </span>
            </Link>

            <button
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition hover:-translate-y-0.5 hover:border-sky-400/60 hover:text-foreground focus:outline-none"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={open}
                aria-label="User menu"
            >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {open && (
                <div className="soft-panel absolute right-0 top-12 z-50 mt-2 flex w-56 flex-col overflow-hidden">
                    <Link href={profileHref} className="border-b border-border/70 px-4 py-4 transition hover:bg-muted/40">
                        <div className="font-semibold">{username}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        {user.role === 'admin' && <div className="text-xs text-red-500 font-bold">Admin</div>}
                    </Link>
                    <Link href="/settings" className="flex items-center gap-2 px-4 py-3 text-sm transition hover:bg-muted/40">
                        <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <Link href="/messages" className="flex items-center gap-2 px-4 py-3 text-sm transition hover:bg-muted/40">
                        <MessageSquareMore className="h-4 w-4" /> Messages
                    </Link>
                    <Link href="/notifications" className="flex items-center gap-2 px-4 py-3 text-sm transition hover:bg-muted/40">
                        <Bell className="h-4 w-4" /> Notifications
                    </Link>
                    <div className="border-t border-border/70 p-2">
                        <Button variant="ghost" className="w-full justify-start rounded-xl px-3 py-2 text-left text-sm gap-2 hover:bg-muted/50" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" /> Sign out
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
