"use client";

import { useState } from "react";
import { TipTapEditor } from "@/components/TipTapEditor";

export function SubmitQueryForm({ submitAction }: { submitAction: (formData: FormData) => Promise<void> }) {
    const [pendingData, setPendingData] = useState<{ title: string, body: string } | null>(null);

    const handleSend = async (formData: FormData, retryData?: { title: string, body: string }) => {
        const title = retryData?.title || (formData.get("title") as string);
        const body = retryData?.body || (formData.get("body") as string);

        if (!title || !body) return;

        if (!retryData) {
            setPendingData({ title, body });
        }

        try {
            const dataToSubmit = new FormData();
            dataToSubmit.append("title", title);
            dataToSubmit.append("body", body);

            await submitAction(dataToSubmit);
            // If it succeeds, it redirects. If not, it falls through or throws.
        } catch (e) {
            console.error("Failed to submit query", e);
            // Stays in pending state to allow retry
        }
    };

    if (pendingData) {
        return (
            <div className="space-y-6">
                <div className="p-6 border-[3px] border-red-500 bg-red-100 dark:bg-red-900/30 shadow-[6px_6px_0_0_#ef4444]">
                    <div className="flex justify-between items-center mb-4 border-b-2 border-red-500/30 pb-2">
                        <span className="font-black text-red-600 uppercase tracking-tight">Failed to Submit (Offline/Error)</span>
                        <div className="flex gap-4">
                            <button onClick={() => setPendingData(null)} className="font-bold text-red-500 hover:underline uppercase text-sm">Discard</button>
                            <button onClick={() => handleSend(new FormData(), pendingData)} className="font-black text-blue-500 hover:underline uppercase text-sm flex items-center gap-1">
                                <span className="text-lg leading-none">↻</span> Retry
                            </button>
                        </div>
                    </div>
                    <div className="font-bold text-xl mb-2">{pendingData.title}</div>
                    <div className="text-sm line-clamp-3 text-muted-foreground" dangerouslySetInnerHTML={{ __html: pendingData.body }} />
                </div>
            </div>
        );
    }

    return (
        <form action={handleSend} className="space-y-6">
            <div>
                <label className="block font-bold mb-2">Title</label>
                <input name="title" required className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="What is your question?" />
            </div>
            <div>
                <label className="block font-bold mb-2">Body</label>
                <TipTapEditor name="body" />
            </div>
            <button type="submit" className="cursor-pointer w-full py-3 font-bold border-[3px] border-black dark:border-white bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                Post Query
            </button>
        </form>
    );
}
