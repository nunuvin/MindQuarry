"use client";
import { useState } from "react";
import { User as UserIcon, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Dummy user for demo; replace with real auth logic
const mockUser = {
    name: "Jane Doe",
    email: "jane@example.com",
    avatarUrl: "",
};


export default function UserMenu({ user }: { user?: typeof mockUser }) {
    const [open, setOpen] = useState(false);

    if (!user) {
        return (
            <div className="flex gap-2">
                <Link href="/login" className="text-sm font-medium text-primary hover:underline px-3 py-2 rounded-md">Login</Link>
                <Link href="/signup" className="text-sm font-medium text-primary hover:underline px-3 py-2 rounded-md">Sign up</Link>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                className="flex items-center gap-2 focus:outline-none"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={open}
            >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border">
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="avatar" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                        <UserIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                </div>
                <span className="font-medium text-base text-foreground hidden sm:block">{user.name}</span>
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-48 bg-card border rounded-lg shadow-lg z-50 flex flex-col">
                    <div className="px-4 py-3 border-b">
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <Link href="#" className="flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm">
                        <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <Button variant="ghost" className="justify-start px-4 py-2 w-full text-left text-sm gap-2" onClick={() => {/* TODO: logout */ }}>
                        <LogOut className="h-4 w-4" /> Logout
                    </Button>
                </div>
            )}
        </div>
    );
}
