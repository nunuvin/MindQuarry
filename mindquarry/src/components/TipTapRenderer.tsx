"use client";

import DOMPurify from 'isomorphic-dompurify';

export function TipTapRenderer({ content }: { content: string }) {
    return (
        <div
            className="prose dark:prose-invert max-w-none prose-pre:bg-black prose-pre:text-white dark:prose-pre:bg-white dark:prose-pre:text-black prose-pre:border-[3px] prose-pre:border-black dark:prose-pre:border-white prose-pre:shadow-[4px_4px_0_0_#000] dark:prose-pre:shadow-[4px_4px_0_0_#fff] prose-blockquote:border-l-4 prose-blockquote:border-black dark:prose-blockquote:border-white prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic font-medium"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
        />
    );
}
