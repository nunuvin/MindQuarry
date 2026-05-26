"use client";

import { forwardRef, useCallback, useId, useImperativeHandle, useMemo, useState } from "react";
import { AtSign, Loader2, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { normalizeMessagingUsernameCandidate, type MessagingUsernameValidationResult } from "@/lib/messagingShared";

export type UsernameToken = {
    username: string;
    label: string;
};

export type UsernameTokenInputHandle = {
    commitPendingInput: () => Promise<boolean>;
    clearTokens: () => void;
};

export const UsernameTokenInput = forwardRef<UsernameTokenInputHandle, {
    name: string;
    label: string;
    placeholder: string;
    description?: string;
    suggestions?: string[];
    initialTokens?: UsernameToken[];
    blockedUsernames?: string[];
    validateUsernameAction: (username: string) => Promise<MessagingUsernameValidationResult>;
    onCtrlEnter?: () => void;
        }>(({
            name,
            label,
            placeholder,
            description,
            suggestions = [],
            initialTokens = [],
            blockedUsernames = [],
            validateUsernameAction,
            onCtrlEnter,
        }, ref) => {
            const datalistId = useId().replace(/:/g, "");
            const [tokens, setTokens] = useState<UsernameToken[]>(initialTokens);
            const [inputValue, setInputValue] = useState("");
            const [error, setError] = useState("");
            const [isValidating, setIsValidating] = useState(false);

            const tokenUsernames = useMemo(() => new Set(tokens.map((token) => token.username.toLowerCase())), [tokens]);
            const blockedUsernameSet = useMemo(() => new Set(blockedUsernames.map((value) => value.toLowerCase())), [blockedUsernames]);

            const commitRawValue = useCallback(async (rawValue: string) => {
                const candidates = Array.from(new Set(
                    rawValue
                        .split(/[\s,]+/)
                        .map((value) => normalizeMessagingUsernameCandidate(value))
                        .filter((value) => value.length > 0),
                ));

                if (candidates.length === 0) {
                    setInputValue("");
                    return true;
                }

                setIsValidating(true);
                setError("");

                let allValid = true;
                const nextTokens = [...tokens];
                const seen = new Set(nextTokens.map((token) => token.username.toLowerCase()));

                try {
                    for (const candidate of candidates) {
                        if (seen.has(candidate.toLowerCase()) || blockedUsernameSet.has(candidate.toLowerCase())) {
                            allValid = false;
                            setError(`@${candidate} is already in this chat.`);
                            continue;
                        }

                        const result = await validateUsernameAction(candidate);
                        if (!result.ok || !result.username) {
                            allValid = false;
                            setError(result.message || `Could not validate @${candidate}.`);
                            continue;
                        }

                        nextTokens.push({
                            username: result.username,
                            label: result.label || result.username,
                        });
                        seen.add(result.username.toLowerCase());
                    }

                    setTokens(nextTokens);
                    setInputValue("");
                    return allValid;
                } finally {
                    setIsValidating(false);
                }
            }, [blockedUsernameSet, tokens, validateUsernameAction]);

            useImperativeHandle(ref, () => ({
                commitPendingInput: () => commitRawValue(inputValue),
                clearTokens: () => {
                    setTokens([]);
                    setInputValue("");
                    setError("");
                },
            }), [commitRawValue, inputValue]);

            const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    onCtrlEnter?.();
                    return;
                }

                if ((event.key === "Enter" || event.key === "," || event.key === " ") && inputValue.trim()) {
                    event.preventDefault();
                    void commitRawValue(inputValue);
                    return;
                }

                if (event.key === "Backspace" && !inputValue && tokens.length > 0) {
                    setTokens((currentTokens) => currentTokens.slice(0, -1));
                    setError("");
                }
            };

            return (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-semibold text-foreground">{label}</label>
                        {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}
                    </div>

                    <div className="rounded-3xl border border-border/70 bg-card/80 p-3 shadow-sm transition focus-within:border-sky-400/70 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]">
                        <div className="flex flex-wrap items-center gap-2">
                            {tokens.map((token) => (
                                <span key={token.username} className="inline-flex items-center gap-2 rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                                    <span>{token.label}</span>
                                    <button
                                        type="button"
                                        aria-label={`Remove ${token.username}`}
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-sky-600 transition hover:bg-sky-500/15 dark:text-sky-300"
                                        onClick={() => {
                                            setTokens((currentTokens) => currentTokens.filter((currentToken) => currentToken.username !== token.username));
                                            setError("");
                                        }}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                    <input type="hidden" name={name} value={token.username} />
                                </span>
                            ))}

                            <div className="relative min-w-56 flex-1">
                                <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={inputValue}
                                    onChange={(event) => setInputValue(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                    list={suggestions.length > 0 ? datalistId : undefined}
                                    placeholder={placeholder}
                                    className="h-11 rounded-2xl border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
                                    aria-label={label}
                                />
                                {suggestions.length > 0 && (
                                    <datalist id={datalistId}>
                                        {suggestions.filter((value) => !tokenUsernames.has(value.toLowerCase())).map((value) => (
                                            <option key={value} value={value} />
                                        ))}
                                    </datalist>
                                )}
                            </div>

                            {isValidating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                    </div>

                    <p className="text-xs font-medium text-muted-foreground">Use space, comma, or Enter to validate a username into a chip. Use Ctrl+Enter to submit.</p>
                    {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
                </div>
            );
        });

UsernameTokenInput.displayName = "UsernameTokenInput";