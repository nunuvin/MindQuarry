"use client";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";



function isValidPassword(password: string) {
    // Must be at least 8 chars, at least 1 letter, at least 1 number
    return (
        password.length >= 8 &&
        /[a-zA-Z]/.test(password) &&
        /[0-9]/.test(password)
    );
}

export default function SignupPage() {
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
            window.location.href = "/";
        } catch (err: any) {
            setError(err.message || "Signup failed");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <form
                onSubmit={handleSignup}
                className="bg-card p-8 rounded-lg shadow-md w-full max-w-md flex flex-col gap-6 border"
            >
                <h1 className="text-2xl font-bold text-center mb-2">Create your account</h1>
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
                            className={getPasswordBorder() + " pr-10"}
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
                            className={getConfirmBorder() + " pr-10"}
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowConfirm(v => !v)}
                            aria-label={showConfirm ? "Hide password" : "Show password"}
                        >
                            {showConfirm ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
                {error && <div className="text-red-500 text-sm">{error}</div>}
                <Button type="submit" className="w-full" disabled={!passwordValid || !passwordsMatch}>
                    Sign up
                </Button>
                <div className="flex justify-between items-center mt-2">
                    <Link href="/login" className="text-sm text-primary hover:underline">Already have an account?</Link>
                </div>
            </form>
        </div>
    );
}
