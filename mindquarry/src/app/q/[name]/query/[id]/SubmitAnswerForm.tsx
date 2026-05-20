"use client";

import { useState, useRef } from "react";
import { TipTapEditor } from "@/components/TipTapEditor";

export function SubmitAnswerForm({ parentId, submitAction }: { parentId?: string, submitAction: (formData: FormData) => Promise<void> }) {
    const [pendingBody, setPendingBody] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const handleSend = async (formData: FormData, retryBody?: string) => {
        const body = retryBody || (formData.get("body") as string);

        if (!body) return;

        if (!retryBody) {
            setPendingBody(body);
            formRef.current?.reset();
        }

        try {
            const dataToSubmit = new FormData();
            dataToSubmit.append("body", body);
            if (parentId) dataToSubmit.append("parent_id", parentId);

            await submitAction(dataToSubmit);
            // If it succeeds, clear pending state
            setPendingBody(null);
        } catch (e) {
            console.error("Failed to submit answer", e);
            // Stays in pending state to allow retry
        }
    };

    if (pendingBody) {
        return (
            <div className="space-y-4">
                <div className="p-4 border-2 border-red-500 bg-red-100 dark:bg-red-900/30 shadow-[4px_4px_0_0_#ef4444]">
                    <div className="flex justify-between items-center mb-2 border-b-2 border-red-500/30 pb-2">
                        <span className="font-bold text-red-600 uppercase tracking-tight text-sm">Failed to Submit Answer</span>
                        <div className="flex gap-4">
                            <button onClick={() => setPendingBody(null)} className="font-bold text-red-500 hover:underline uppercase text-xs">Discard</button>
                            <button onClick={() => handleSend(new FormData(), pendingBody)} className="font-black text-blue-500 hover:underline uppercase text-xs flex items-center gap-1">
                                <span className="text-base leading-none">↻</span> Retry
                            </button>
                        </div>
                    </div>
                    <div className="text-sm line-clamp-3 text-muted-foreground" dangerouslySetInnerHTML={{ __html: pendingBody }} />
                </div>
            </div>
        );
    }

    if (parentId) {
        return (
            <form ref={formRef} action={handleSend} className="mt-2 space-y-2">
                <input type="hidden" name="parent_id" value={parentId} />
                <TipTapEditor name="body" />
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] cursor-pointer hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all text-xs">
                    Post Reply
                </button>
            </form>
        );
    }

    return (
        <form ref={formRef} action={handleSend} className="space-y-4">
            <TipTapEditor name="body" />
            <button type="submit" className="px-8 py-3 bg-blue-500 text-white font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:bg-blue-600 transition-colors">
                Post Answer
            </button>
        </form>
    );
}
