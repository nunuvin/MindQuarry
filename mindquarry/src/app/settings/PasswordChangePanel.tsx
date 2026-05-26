"use client";

import { useActionState } from "react";

export type PasswordChangeActionState = {
    status: "idle" | "success" | "error";
    message: string;
};

const initialState: PasswordChangeActionState = {
    status: "idle",
    message: "",
};

export function PasswordChangePanel({
    action,
    forceResetRequired = false,
}: {
    action: (state: PasswordChangeActionState, formData: FormData) => Promise<PasswordChangeActionState>;
    forceResetRequired?: boolean;
}) {
    const [state, formAction, isPending] = useActionState(action, initialState);

    return (
        <div className="rounded-[24px] border border-border/70 bg-muted/20 p-6">
            <h2 className="font-display text-xl font-semibold tracking-tight">Security</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">Change your password here. Password resets from admins also land here on your next successful sign-in.</p>

            {forceResetRequired && (
                <div className="mt-4 rounded-[20px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Your account was flagged for an immediate password update. Choose a new password before continuing normal use.
                </div>
            )}

            <form action={formAction} className="mt-6 space-y-5">
                <div>
                    <label className="mb-2 block text-sm font-semibold">Current Password</label>
                    <input name="current_password" type="password" required className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-sm font-semibold">New Password</label>
                        <input name="new_password" type="password" required minLength={8} className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-semibold">Confirm New Password</label>
                        <input name="confirm_password" type="password" required minLength={8} className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                </div>

                <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <input type="checkbox" name="revoke_other_sessions" defaultChecked className="h-4 w-4" />
                    Sign out my other active sessions
                </label>

                {state.message && (
                    <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${state.status === "success" ? "border border-green-500/30 bg-green-500/10 text-green-600" : "border border-red-500/30 bg-red-500/10 text-red-500"}`}>
                        {state.message}
                    </div>
                )}

                <button type="submit" disabled={isPending} className="soft-button-primary w-full justify-center rounded-full py-3 disabled:cursor-not-allowed disabled:opacity-60">
                    {isPending ? "Updating Password..." : "Change Password"}
                </button>
            </form>
        </div>
    );
}