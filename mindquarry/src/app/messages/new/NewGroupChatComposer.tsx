"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";

import { UsernameTokenInput, type UsernameTokenInputHandle } from "@/components/username-token-input";
import { Input } from "@/components/ui/input";
import type { MessagingUsernameValidationResult } from "@/lib/messagingShared";

type CreateGroupResult = {
    ok: boolean;
    error?: string;
    conversationId?: string;
};

export default function NewGroupChatComposer({
    suggestedUsernames = [],
    createGroupAction,
    validateParticipantUsernameAction,
}: {
    suggestedUsernames?: string[];
    createGroupAction: (formData: FormData) => Promise<CreateGroupResult>;
    validateParticipantUsernameAction: (username: string) => Promise<MessagingUsernameValidationResult>;
}) {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement | null>(null);
    const participantInputRef = useRef<UsernameTokenInputHandle | null>(null);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submitGroup = async () => {
        const pendingUsersCommitted = await participantInputRef.current?.commitPendingInput();
        if (pendingUsersCommitted === false) {
            return;
        }

        if (!formRef.current) {
            return;
        }

        setError("");
        setIsSubmitting(true);

        try {
            const result = await createGroupAction(new FormData(formRef.current));
            if (!result.ok || !result.conversationId) {
                setError(result.error || "Unable to create that group chat.");
                return;
            }

            router.push(`/messages/${result.conversationId}`);
            router.refresh();
        } catch (submitError) {
            console.error("Failed to create group chat", submitError);
            setError("Unable to create that group chat.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page-shell max-w-4xl">
            <div className="soft-panel p-8 sm:p-10">
                <Link href="/messages" className="soft-button mb-4 inline-flex rounded-full px-4 py-2">&larr; Back to Inbox</Link>

                <div className="mb-8">
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">Group Chats</p>
                    <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">Create Group Chat</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Name the room so you can keep multiple groups with the same people apart, then validate usernames into blue chips before you initialize it.</p>
                </div>

                <form
                    ref={formRef}
                    className="space-y-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submitGroup();
                    }}
                >
                    <div className="space-y-3">
                        <label htmlFor="group-name" className="block text-sm font-semibold text-foreground">Group Name</label>
                        <div className="relative flex items-center overflow-hidden rounded-full border border-border/70 bg-card/85 shadow-sm transition duration-200 focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]">
                            <UsersRound className="absolute left-4 h-4 w-4 text-muted-foreground" />
                            <div className="absolute left-10 h-5 w-px bg-border/80" />
                            <Input
                                id="group-name"
                                name="name"
                                required
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                onKeyDown={(event) => {
                                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                                        event.preventDefault();
                                        void submitGroup();
                                    }
                                }}
                                className="h-12 border-0 bg-transparent pl-14 pr-4 text-sm shadow-none focus-visible:ring-0"
                                placeholder="What do you want to call this group?"
                            />
                        </div>
                    </div>

                    <UsernameTokenInput
                        ref={participantInputRef}
                        name="participants"
                        label="Participants"
                        placeholder="Type a username to add to the group"
                        description="Space, comma, or Enter validates a username. Ctrl+Enter creates the group once the list looks right."
                        suggestions={suggestedUsernames}
                        validateUsernameAction={validateParticipantUsernameAction}
                        onCtrlEnter={() => {
                            void submitGroup();
                        }}
                    />

                    {error && <p className="text-sm font-semibold text-red-500">{error}</p>}

                    <button type="submit" disabled={isSubmitting} className="soft-button-primary w-full justify-center rounded-full py-3 disabled:cursor-not-allowed disabled:opacity-60">
                        {isSubmitting ? "Creating..." : "Init Group"}
                    </button>
                </form>
            </div>
        </div>
    );
}