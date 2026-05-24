"use client";

import { useEffect, useState } from "react";
import { TipTapEditor } from "@/components/TipTapEditor";
import { hasRichTextContent } from "@/lib/utils";

type SubmitQueryResult = {
    ok: boolean;
    error?: string;
};

type SubmitQueryTag = {
    id: string;
    name: string | null;
    description: string | null;
    quarry_id: string | null;
};

export function SubmitQueryForm({
    submitAction,
    availableTags = [],
    allowCustomTags = false,
    initialTitle = "",
    initialBody = "",
    selectedTagIds = [],
    initialCustomTags = "",
    submitLabel = "Post Query",
    submittingLabel = "Posting...",
}: {
    submitAction: (formData: FormData) => Promise<SubmitQueryResult | void>;
    availableTags?: SubmitQueryTag[];
    allowCustomTags?: boolean;
    initialTitle?: string;
    initialBody?: string;
    selectedTagIds?: string[];
    initialCustomTags?: string;
    submitLabel?: string;
    submittingLabel?: string;
}) {
    const [title, setTitle] = useState(initialTitle);
    const [body, setBody] = useState(initialBody);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setTitle(initialTitle);
        setBody(initialBody);
    }, [initialTitle, initialBody]);

    const handleSend = async (formData: FormData) => {
        const nextTitle = (formData.get("title") as string)?.trim() || title.trim();
        const nextBody = (formData.get("body") as string) || body;

        if (!nextTitle || !hasRichTextContent(nextBody)) {
            setError("Both the title and body are required.");
            return;
        }

        setError("");
        setIsSubmitting(true);

        try {
            const dataToSubmit = new FormData();
            dataToSubmit.append("title", nextTitle);
            dataToSubmit.append("body", nextBody);
            for (const tagId of formData.getAll("tag_ids")) {
                dataToSubmit.append("tag_ids", String(tagId));
            }

            const customTags = formData.get("custom_tags");
            if (typeof customTags === "string") {
                dataToSubmit.append("custom_tags", customTags);
            }

            const result = await submitAction(dataToSubmit);
            if (result && !result.ok) {
                setError(result.error || "Failed to submit query.");
            }
        } catch (error) {
            console.error("Failed to submit query", error);
            setError("Failed to submit query.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form action={handleSend} className="space-y-6">
            <div>
                <label htmlFor="submit-query-title" className="block font-bold mb-2">Title</label>
                <input id="submit-query-title" name="title" required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="What is your question?" />
            </div>
            <div>
                <label className="block font-bold mb-2">Body</label>
                <TipTapEditor name="body" value={body} onChange={setBody} placeholder="Add the details people need to answer well..." />
            </div>
            {availableTags.length > 0 && (
                <div className="space-y-3">
                    <div>
                        <label className="block font-bold mb-2">Tags</label>
                        <p className="text-sm text-muted-foreground">Choose from the instance defaults and the tags available in this quarry.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => (
                            <label key={tag.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black bg-card px-3 py-2 text-sm font-semibold dark:border-white">
                                <input type="checkbox" name="tag_ids" value={tag.id} className="h-4 w-4" defaultChecked={selectedTagIds.includes(tag.id)} />
                                <span>{tag.name}</span>
                                {tag.quarry_id && <span className="text-[10px] uppercase tracking-[0.14em] text-sky-600">Quarry</span>}
                            </label>
                        ))}
                    </div>
                </div>
            )}
            {allowCustomTags && (
                <div>
                    <label htmlFor="submit-query-custom-tags" className="block font-bold mb-2">Custom Tags</label>
                    <input id="submit-query-custom-tags" name="custom_tags" defaultValue={initialCustomTags} className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="comma-separated, e.g. ranking, indexing, moderation" />
                    <p className="mt-2 text-xs text-muted-foreground">Custom tags are added to this quarry if they do not already exist.</p>
                </div>
            )}
            {error && <p className="text-sm font-bold text-red-500">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="cursor-pointer w-full py-3 font-bold border-[3px] border-black dark:border-white bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? submittingLabel : submitLabel}
            </button>
        </form>
    );
}
