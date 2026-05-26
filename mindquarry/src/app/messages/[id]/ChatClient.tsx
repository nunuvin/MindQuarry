"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { TipTapEditor } from "@/components/TipTapEditor";
import { TipTapRenderer } from "@/components/TipTapRenderer";
import { isDeletedMessageBody } from "@/lib/messageContent";
import { hasRichTextContent } from "@/lib/utils";

type SendMessageResult = {
    ok: boolean;
    error?: string;
};

type DeleteMessageResult = {
    ok: boolean;
    error?: string;
};

type HideMessageResult = {
    ok: boolean;
    error?: string;
};

export function ChatClient({
    conversationId,
    displayName,
    messages,
    userId,
    isGlobalAdmin,
    sendMessageAction,
    deleteMessageAction,
    hideMessageAction,
    otherParticipants
}: {
    conversationId: string;
    displayName: string;
    messages: {
        id: string;
        body: string | null;
        created_at: Date | null;
        sender_id: string | null;
        is_hidden?: boolean | null;
        name: string | null;
        displayUsername: string | null;
        username: string | null;
    }[];
    userId: string;
    isGlobalAdmin: boolean;
    sendMessageAction: (formData: FormData) => Promise<SendMessageResult>;
    deleteMessageAction: (formData: FormData) => Promise<DeleteMessageResult>;
    hideMessageAction: (formData: FormData) => Promise<HideMessageResult>;
    otherParticipants: { user_id: string, last_read_at: Date | null }[];
}) {
    const router = useRouter();
    const bottomRef = useRef<HTMLDivElement>(null);
    const lastReadMessageIdRef = useRef<string | null>(null);

    // Pending messages that failed to send
    const [pendingMessages, setPendingMessages] = useState<{ id: string, body: string }[]>([]);
    const [composerBody, setComposerBody] = useState("");
    const [sendError, setSendError] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
    const [hidingMessageId, setHidingMessageId] = useState<string | null>(null);
    const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

    const upsertPendingMessage = (id: string, body: string) => {
        setPendingMessages((currentMessages) => {
            if (currentMessages.some((message) => message.id === id)) {
                return currentMessages.map((message) => message.id === id ? { ...message, body } : message);
            }

            return [...currentMessages, { id, body }];
        });
    };

    const handleSend = async (body: string, pendingId?: string) => {
        if (!hasRichTextContent(body)) {
            setSendError("Message cannot be empty.");
            return;
        }

        const messageId = pendingId || globalThis.crypto?.randomUUID?.() || `pending-${Date.now()}`;

        setSendError("");
        setIsSending(true);

        try {
            const formData = new FormData();
            formData.append("body", body);
            const result = await sendMessageAction(formData);

            if (!result.ok) {
                upsertPendingMessage(messageId, body);
                setSendError(result.error || "Failed to send message.");
                return;
            }

            setPendingMessages(prev => prev.filter(m => m.id !== messageId));
            setComposerBody("");
        } catch (error) {
            console.error("Failed to send message", error);
            upsertPendingMessage(messageId, body);
            setSendError("Failed to send message.");
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        setSendError("");
        setDeletingMessageId(messageId);
        setOpenActionMenuId(null);

        try {
            const formData = new FormData();
            formData.append("message_id", messageId);
            const result = await deleteMessageAction(formData);

            if (!result.ok) {
                setSendError(result.error || "Failed to delete message.");
            }
        } catch (error) {
            console.error("Failed to delete message", error);
            setSendError("Failed to delete message.");
        } finally {
            setDeletingMessageId(null);
        }
    };

    const handleHideMessage = async (messageId: string) => {
        setSendError("");
        setHidingMessageId(messageId);
        setOpenActionMenuId(null);

        try {
            const formData = new FormData();
            formData.append("message_id", messageId);
            const result = await hideMessageAction(formData);

            if (!result.ok) {
                setSendError(result.error || "Failed to hide message.");
            }
        } catch (error) {
            console.error("Failed to hide message", error);
            setSendError("Failed to hide message.");
        } finally {
            setHidingMessageId(null);
        }
    };

    useEffect(() => {
        if (typeof bottomRef.current?.scrollIntoView === "function") {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, pendingMessages]);

    useEffect(() => {
        const latestMessageId = messages[messages.length - 1]?.id;

        const markAsRead = () => {
            if (!latestMessageId || document.visibilityState !== "visible" || lastReadMessageIdRef.current === latestMessageId) {
                return;
            }

            lastReadMessageIdRef.current = latestMessageId;
            fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(() => {
                lastReadMessageIdRef.current = null;
            });
        };

        markAsRead();

        const handleVisible = () => markAsRead();
        document.addEventListener("visibilitychange", handleVisible);
        window.addEventListener("focus", handleVisible);

        return () => {
            document.removeEventListener("visibilitychange", handleVisible);
            window.removeEventListener("focus", handleVisible);
        };
    }, [conversationId, messages]);

    useEffect(() => {
        const evtSource = new EventSource(`/api/chat/${conversationId}/stream`);

        evtSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "new_message" && data.conversationId === conversationId) {
                    router.refresh();
                }
            } catch {}
        };

        return () => {
            evtSource.close();
        };
    }, [conversationId, router]);

    const handleComposerKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            if (!isSending) {
                void handleSend(composerBody);
            }
            return true;
        }

        return false;
    };

    return (
        <div className="page-shell flex h-[calc(100vh-5rem)] max-w-4xl flex-col">
            <div className="mb-4 flex items-center gap-4">
                <Link href="/messages" className="soft-button h-10 w-10 rounded-full p-0">
                    &larr;
                </Link>
                <h1 className="font-display flex-1 truncate text-2xl font-semibold tracking-tight">{displayName}</h1>
                <Link href={`/messages/${conversationId}/report`} className="soft-button rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-500">
                    Report chat
                </Link>
            </div>

            <div className="soft-panel relative flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
                    {messages.map(msg => {
                        const isMe = msg.sender_id === userId;
                        const isDeleted = isDeletedMessageBody(msg.body);
                        const canDelete = (isMe || isGlobalAdmin) && !isDeleted;
                        const canHide = isGlobalAdmin && !msg.is_hidden && !isDeleted;
                        const canReport = !msg.is_hidden && !isDeleted;
                        const showActions = canDelete || canHide || canReport;
                        return (
                            <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        {isMe ? 'You' : (msg.displayUsername || msg.username || msg.name)}
                                    </span>
                                    {showActions && (
                                        <div className="relative">
                                            <button
                                                type="button"
                                                aria-label={openActionMenuId === msg.id ? "Close message actions" : "Open message actions"}
                                                onClick={() => setOpenActionMenuId((currentId) => currentId === msg.id ? null : msg.id)}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground transition hover:text-foreground"
                                            >
                                                <Ellipsis className="h-4 w-4" />
                                            </button>
                                            {openActionMenuId === msg.id && (
                                                <div className={`absolute top-9 z-20 min-w-40 rounded-2xl border border-border/70 bg-card p-2 shadow-lg ${isMe ? 'right-0' : 'left-0'}`}>
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                            disabled={deletingMessageId === msg.id}
                                                            className="flex w-full rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.16em] text-red-500 transition hover:bg-muted disabled:opacity-60"
                                                        >
                                                            {deletingMessageId === msg.id ? "Deleting..." : "Delete message"}
                                                        </button>
                                                    )}
                                                    {canHide && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleHideMessage(msg.id)}
                                                            disabled={hidingMessageId === msg.id}
                                                            className="flex w-full rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.16em] text-amber-600 transition hover:bg-muted disabled:opacity-60"
                                                        >
                                                            {hidingMessageId === msg.id ? "Hiding..." : "Hide message"}
                                                        </button>
                                                    )}
                                                    {canReport && (
                                                        <Link
                                                            href={`/messages/${conversationId}/report?messageId=${encodeURIComponent(msg.id)}`}
                                                            className="flex w-full rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.16em] text-red-500 transition hover:bg-muted"
                                                            onClick={() => setOpenActionMenuId(null)}
                                                        >
                                                            Report message
                                                        </Link>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className={`max-w-full rounded-[22px] border border-border/70 px-4 py-3 text-sm font-medium shadow-sm ${isMe ? 'bg-sky-500/10' : 'bg-card/80'}`}>
                                    {msg.is_hidden ? (
                                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Message hidden by moderation.</span>
                                    ) : isDeleted ? (
                                        <span className="italic text-muted-foreground/80">message deleted</span>
                                    ) : (
                                        <TipTapRenderer content={msg.body || ""} />
                                    )}
                                </div>
                                {isMe && otherParticipants.some(p => p.last_read_at && msg.created_at && new Date(p.last_read_at) >= new Date(msg.created_at)) && (
                                    <span className="text-[10px] font-bold text-green-600 mt-1 self-end uppercase">Read ✓</span>
                                )}
                            </div>
                        );
                    })}

                    {pendingMessages.map(msg => (
                        <div key={msg.id} className="flex flex-col max-w-[80%] self-end items-end">
                            <div className="flex gap-2 items-center mb-1">
                                <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
                                    Failed to send
                                </span>
                            </div>
                            <div className="max-w-full rounded-[22px] border border-red-500/50 bg-red-500/10 px-4 py-3 shadow-sm">
                                <TipTapRenderer content={msg.body} />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => setPendingMessages(prev => prev.filter(m => m.id !== msg.id))} className="text-xs font-bold text-red-500 hover:underline uppercase">Discard</button>
                                <button onClick={() => handleSend(msg.body, msg.id)} className="text-xs font-bold text-blue-500 hover:underline uppercase flex items-center gap-1">
                                    <span className="text-lg leading-none">↻</span> Retry
                                </button>
                            </div>
                        </div>
                    ))}

                    {messages.length === 0 && pendingMessages.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground font-bold">
                            Send a message to start the conversation.
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="border-t border-border/70 bg-muted/20 p-4">
                    <form action={(formData) => handleSend((formData.get("body") as string) || composerBody)} className="space-y-4">
                        <TipTapEditor name="body" value={composerBody} onChange={setComposerBody} onKeyDown={handleComposerKeyDown} placeholder="Type a message, drop in a quote, add a link, or format code..." dense />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-muted-foreground">Press Enter to send. Use Shift+Enter for a new line.</p>
                            <button type="submit" disabled={isSending} className="soft-button-primary min-w-32 justify-center rounded-full px-6 py-3 disabled:cursor-not-allowed disabled:opacity-60">
                                {isSending ? "Sending..." : "Send"}
                            </button>
                        </div>
                        {sendError && <p className="text-sm font-semibold text-red-500">{sendError}</p>}
                    </form>
                </div>
            </div>
        </div>
    );
}
