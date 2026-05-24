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

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [username, setUsername] = useState("");


    const passwordLengthValid = password.length >= 8;
    const passwordLetterValid = /[a-zA-Z]/.test(password);
    const passwordNumberValid = /[0-9]/.test(password);
    const passwordSpecialValid = /[^a-zA-Z0-9]/.test(password);
    const passwordValid = passwordLengthValid && passwordLetterValid && passwordNumberValid;
    const passwordsMatch = password && confirmPassword && password === confirmPassword;

    const getPasswordBorder = () => {
        if (!password) return "";
        if (!passwordValid) return "border-red-500 focus-visible:ring-red-500";
        if (passwordsMatch) return "border-green-500 focus-visible:ring-green-500";
        return "";
    };

    const getConfirmBorder = () => {
        if (!confirmPassword) return "";
        if (!passwordValid) return "border-red-500 focus-visible:ring-red-500";
        if (passwordsMatch) return "border-green-500 focus-visible:ring-green-500";
        if (confirmPassword && password !== confirmPassword) return "border-red-500 focus-visible:ring-red-500";
        return "";
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!passwordValid || !passwordsMatch) return;
        try {
            const session = await authClient.signUp.email({
                email,
                password,
                username,
                name: username, // Use username as name if no separate name field
            });
            if (session.error) throw new Error(session.error.message || "Signup failed");
            router.replace("/");
            router.refresh();
        } catch (error: unknown) {
            setError(getErrorMessage(error, "Signup failed"));
        }
    };

    return (
        <div className="page-shell flex min-h-[calc(100vh-5rem)] items-center justify-center">
            <form
                onSubmit={handleSignup}
                className="soft-panel w-full max-w-2xl px-8 py-10 sm:px-10 sm:py-12 flex flex-col gap-6"
            >
                <div>
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">Join MindQuarry</p>
                    <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">Create your account</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Set up a profile that works across communities, messaging, and future reputation features.</p>
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="username" className="text-sm font-medium">Username</label>
                    <Input
                        id="username"
                        type="text"
                        autoComplete="username"
                        required
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="your username"
                        className="h-12 rounded-2xl"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-sm font-medium">Email</label>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-12 rounded-2xl"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="password" className="text-sm font-medium">Password</label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="At least 8 chars, 1 non-letter"
                            className={getPasswordBorder() + " h-12 rounded-2xl pr-12"}
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
                    <ul className="mt-2 ml-1 flex flex-col gap-1 text-sm">
                        <li className={`flex items-center gap-2 ${passwordLengthValid ? "text-muted-foreground line-through" : "text-red-500"}`}>
                            <span className="inline-block w-4 text-center">
                                {passwordLengthValid ? "-" : <span className="font-bold">×</span>}
                            </span>
                            At least 8 characters
                        </li>
                        <li className={`flex items-center gap-2 ${passwordLetterValid ? "text-muted-foreground line-through" : "text-red-500"}`}>
                            <span className="inline-block w-4 text-center">
                                {passwordLetterValid ? "-" : <span className="font-bold">×</span>}
                            </span>
                            At least 1 letter
                        </li>
                        <li className={`flex items-center gap-2 ${passwordNumberValid ? "text-muted-foreground line-through" : "text-red-500"}`}>
                            <span className="inline-block w-4 text-center">
                                {passwordNumberValid ? "-" : <span className="font-bold">×</span>}
                            </span>
                            At least 1 number
                        </li>
                        <li className={`flex items-center gap-2 ${passwordSpecialValid ? "text-teal-600 line-through" : "text-teal-600"}`}>
                            <span className="inline-block w-4 text-center">
                                {passwordSpecialValid ? "-" : <span className="font-bold">×</span>}
                            </span>
                            <span>At least 1 special character <span className="text-xs text-muted-foreground">(optional)</span></span>
                        </li>
                        <li className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? "text-teal-600 line-through" : "text-teal-600"}`}>
                            <span className="inline-block w-4 text-center">
                                {/[A-Z]/.test(password) ? "-" : <span className="font-bold">×</span>}
                            </span>
                            At least 1 capital letter <span className="text-xs text-muted-foreground">(optional)</span>
                        </li>
                    </ul>
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirm ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            className={getConfirmBorder() + " h-12 rounded-2xl pr-12"}
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground transition hover:text-foreground"
                            onClick={() => setShowConfirm(v => !v)}
                            aria-label={showConfirm ? "Hide password" : "Show password"}
                        >
                            {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
                {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
                <Button type="submit" className="h-12 w-full rounded-full bg-sky-600 text-white hover:bg-sky-700" disabled={!passwordValid || !passwordsMatch}>
                    Sign up
                </Button>
                <div className="flex justify-between items-center mt-2">
                    <Link href="/login" className="text-sm text-primary hover:underline">Already have an account?</Link>
                </div>
            </form>
        </div>
    );
}
