"use client";

import { useEffect, useState } from "react";
import { TipTapEditor } from "@/components/TipTapEditor";
import { hasRichTextContent } from "@/lib/utils";

type SubmitAnswerResult = {
    ok: boolean;
    error?: string;
};

export function SubmitAnswerForm({
    parentId,
    defaultBody = "",
    submitAction,
    submitLabel,
    submittingLabel,
    emptyMessage,
    resetOnSuccess = true,
    hiddenFields = {},
}: {
    parentId?: string;
    defaultBody?: string;
    submitAction: (formData: FormData) => Promise<SubmitAnswerResult>;
    submitLabel?: string;
    submittingLabel?: string;
    emptyMessage?: string;
    resetOnSuccess?: boolean;
    hiddenFields?: Record<string, string>;
}) {
    const [body, setBody] = useState(defaultBody);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setBody(defaultBody);
    }, [defaultBody]);

    const handleSend = async (formData: FormData) => {
        const nextBody = (formData.get("body") as string) || body;

        if (!hasRichTextContent(nextBody)) {
            setError(emptyMessage || (parentId ? "Reply cannot be empty." : "Answer cannot be empty."));
            return;
        }

        setError("");
        setIsSubmitting(true);

        try {
            const dataToSubmit = new FormData();
            dataToSubmit.append("body", nextBody);
            if (parentId) dataToSubmit.append("parent_id", parentId);
            for (const [key, value] of Object.entries(hiddenFields)) {
                dataToSubmit.append(key, value);
            }

            const result = await submitAction(dataToSubmit);

            if (!result.ok) {
                setError(result.error || "Failed to post your answer.");
                return;
            }

            if (resetOnSuccess) {
                setBody(defaultBody);
            }
        } catch (error) {
            console.error("Failed to submit answer", error);
            setError("Failed to post your answer.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (parentId) {
        return (
            <form action={handleSend} className="mt-2 space-y-3">
                <input type="hidden" name="parent_id" value={parentId} />
                {Object.entries(hiddenFields).map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value} />
                ))}
                <TipTapEditor name="body" value={body} onChange={setBody} placeholder="Add your reply..." />
                {error && <p className="text-sm font-bold text-red-500">{error}</p>}
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-500 text-white font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] cursor-pointer hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all text-xs disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmitting ? (submittingLabel || "Posting...") : (submitLabel || "Post Reply")}
                </button>
            </form>
        );
    }

    return (
        <form action={handleSend} className="space-y-4">
            {Object.entries(hiddenFields).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
            ))}
            <TipTapEditor name="body" value={body} onChange={setBody} placeholder="Share your answer..." />
            {error && <p className="text-sm font-bold text-red-500">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-blue-500 text-white font-black uppercase border-[3px] border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:bg-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? (submittingLabel || "Posting...") : (submitLabel || "Post Answer")}
            </button>
        </form>
    );
}
