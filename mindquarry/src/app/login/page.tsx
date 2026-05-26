"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}

export default function LoginPage() {
    const router = useRouter();
    const [identifier, setIdentifier] = useState(""); // username or email
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            // Decide whether identifier is an email or username
            let session;
            if (identifier.includes("@")) {
                session = await authClient.signIn.email({ email: identifier, password });
            } else {
                session = await authClient.signIn.username({ username: identifier, password });
            }
            if (session.error) throw new Error(session.error.message || "Login failed");
            let redirectHref = "/";
            try {
                const response = await fetch("/api/auth/password-reset-status", { cache: "no-store" });
                if (response.ok) {
                    const payload = await response.json() as { required?: boolean };
                    if (payload.required) {
                        redirectHref = "/settings";
                    }
                }
            } catch {}

            router.replace(redirectHref);
            router.refresh();
        } catch (error: unknown) {
            setError(getErrorMessage(error, "Login failed"));
        }
    };

    return (
        <div className="page-shell flex min-h-[calc(100vh-5rem)] items-center justify-center">
            <div className="soft-panel w-full max-w-xl overflow-hidden">
                <form
                    onSubmit={handleLogin}
                    className="flex flex-col gap-6 px-8 py-10 sm:px-10 sm:py-12"
                >
                    <div>
                        <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Use your username or email to continue.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="identifier" className="text-sm font-medium">Username or Email</label>
                        <Input
                            id="identifier"
                            type="text"
                            autoComplete="username"
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            placeholder="your username or email"
                            className="h-12 rounded-2xl"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label htmlFor="password" className="text-sm font-medium">Password</label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="h-12 rounded-2xl pr-12"
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground transition hover:text-foreground"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
                    <Button type="submit" className="h-12 rounded-full bg-sky-600 text-white hover:bg-sky-700">Sign in</Button>
                    <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-muted-foreground">Password reset lives in settings.</span>
                        <Link href="/signup" className="text-sm text-primary hover:underline">Sign up</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
