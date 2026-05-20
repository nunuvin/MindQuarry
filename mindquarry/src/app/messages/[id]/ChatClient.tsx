"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ChatClient({
    conversationId,
    displayName,
    messages,
    userId,
    sendMessageAction,
    otherParticipants
}: {
    conversationId: string;
    displayName: string;
    messages: {
        id: string;
        body: string | null;
        created_at: Date | null;
        sender_id: string | null;
        name: string | null;
        displayUsername: string | null;
        username: string | null;
    }[];
    userId: string;
    sendMessageAction: (formData: FormData) => Promise<void>;
    otherParticipants: { user_id: string, last_read_at: Date | null }[];
}) {
    const router = useRouter();
    const bottomRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    // Pending messages that failed to send
    const [pendingMessages, setPendingMessages] = useState<{ id: string, body: string }[]>([]);

    const handleSend = async (body: string, pendingId?: string) => {
        if (!body.trim()) return;
        const newId = pendingId || Math.random().toString(36).substring(7);

        if (!pendingId) {
            setPendingMessages(prev => [...prev, { id: newId, body }]);
            formRef.current?.reset();
        }

        try {
            const formData = new FormData();
            formData.append("body", body);
            await sendMessageAction(formData);
            // If successful, remove from pending
            setPendingMessages(prev => prev.filter(m => m.id !== newId));
        } catch (e) {
            console.error("Failed to send message", e);
            // Stays in pending list to allow retry
        }
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        // Mark as read when messages change and we are viewing them
        fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(() => {});
    }, [messages, conversationId]);

    useEffect(() => {
        const evtSource = new EventSource(`/api/chat/${conversationId}/stream`);

        evtSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if ((data.type === "new_message" || data.type === "read_receipt") && data.conversationId === conversationId) {
                    router.refresh();
                }
            } catch (e) {}
        };

        return () => {
            evtSource.close();
        };
    }, [conversationId, router]);

    return (
        <div className="max-w-3xl mx-auto mt-4 p-4 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex items-center gap-4 mb-4">
                <Link href="/messages" className="font-bold border-[3px] border-black dark:border-white w-10 h-10 flex items-center justify-center hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]">
                    &larr;
                </Link>
                <h1 className="text-2xl font-black uppercase flex-1 truncate">{displayName}</h1>
            </div>

            <div className="flex-1 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff] flex flex-col overflow-hidden relative">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
                    {messages.map(msg => {
                        const isMe = msg.sender_id === userId;
                        return (
                            <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                <div className="flex gap-2 items-center mb-1">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        {isMe ? 'You' : (msg.displayUsername || msg.username || msg.name)}
                                    </span>
                                </div>
                                <div className={`p-3 border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] whitespace-pre-wrap text-sm font-medium ${isMe ? 'bg-blue-100 dark:bg-blue-900' : 'bg-muted/50'}`}>
                                    {msg.body}
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
                            <div className="p-3 border-2 border-red-500 shadow-[2px_2px_0_0_#ef4444] whitespace-pre-wrap text-sm font-medium bg-red-100 dark:bg-red-900/30">
                                {msg.body}
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

                <div className="p-4 border-t-[3px] border-black dark:border-white bg-muted/20">
                    <form ref={formRef} action={(formData) => handleSend(formData.get("body") as string)} className="flex gap-4">
                        <input name="body" required autoComplete="off" placeholder="Type a message..." className="flex-1 p-3 border-2 border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm" />
                        <button type="submit" className="px-8 bg-blue-500 text-white font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:bg-blue-600 transition-colors">
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
