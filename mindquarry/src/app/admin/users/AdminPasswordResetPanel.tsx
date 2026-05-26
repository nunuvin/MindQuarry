"use client";

import { useActionState } from "react";

export type AdminPasswordResetActionState = {
    status: "idle" | "success" | "error";
    message: string;
    temporaryPassword?: string;
    targetUsername?: string;
};

const initialState: AdminPasswordResetActionState = {
    status: "idle",
    message: "",
};

export function AdminPasswordResetPanel({
    action,
}: {
    action: (state: AdminPasswordResetActionState, formData: FormData) => Promise<AdminPasswordResetActionState>;
}) {
    const [state, formAction, isPending] = useActionState(action, initialState);

    return (
        <div className="p-6 bg-amber-500/5 border-2 border-amber-500/40">
            <h2 className="font-bold mb-4 uppercase text-amber-700 dark:text-amber-300">Reset User Password</h2>
            <form action={formAction} className="space-y-4">
                <input name="username" required placeholder="Exact username to reset" className="w-full p-2 border-2 border-amber-500 bg-card outline-none focus:ring-2 focus:ring-amber-500" />
                <div>
                    <label className="mb-2 block text-sm font-semibold">Temporary password length</label>
                    <input type="number" name="password_length" min={8} max={64} defaultValue={16} className="w-full p-2 border-2 border-amber-500 bg-card outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <p className="text-sm text-muted-foreground">The generated password uses keyboard-friendly characters and flags the user for an immediate password change on their next successful sign-in.</p>

                {state.message && (
                    <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${state.status === "success" ? "border border-green-500/30 bg-green-500/10 text-green-600" : "border border-red-500/30 bg-red-500/10 text-red-500"}`}>
                        {state.message}
                    </div>
                )}

                {state.temporaryPassword && state.targetUsername && (
                    <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Temporary password for {state.targetUsername}</div>
                        <div className="mt-2 break-all font-mono text-lg font-semibold text-foreground">{state.temporaryPassword}</div>
                    </div>
                )}

                <button type="submit" disabled={isPending} className="px-6 py-2 bg-amber-500 text-white font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                    {isPending ? "Resetting..." : "Generate Temporary Password"}
                </button>
            </form>
        </div>
    );
}