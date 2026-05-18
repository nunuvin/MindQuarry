"use client";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
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
            window.location.href = "/";
        } catch (err: any) {
            setError(err.message || "Login failed");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <form
                onSubmit={handleLogin}
                className="bg-card p-8 rounded-lg shadow-md w-full max-w-md flex flex-col gap-6 border"
            >
                <h1 className="text-2xl font-bold text-center mb-2">Sign in to your account</h1>
                <div className="flex flex-col gap-2">
                    <label htmlFor="identifier" className="text-sm font-medium">Username or Email</label>
                    <Input
                        id="identifier"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        placeholder="your username or email"
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
                            className="pr-10"
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(v => !v)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
                {error && <div className="text-red-500 text-sm">{error}</div>}
                <Button type="submit" className="w-full">Login</Button>
                <div className="flex justify-between items-center mt-2">
                    <Link href="#" className="text-sm text-muted-foreground hover:underline">Forgot password?</Link>
                    <Link href="/signup" className="text-sm text-primary hover:underline">Sign up</Link>
                </div>
            </form>
        </div>
    );
}
