"use client";

import DOMPurify from 'isomorphic-dompurify';

export function TipTapRenderer({ content }: { content: string }) {
    return (
        <div
            className="prose prose-slate dark:prose-invert max-w-none prose-p:text-foreground/90 prose-p:leading-7 prose-a:text-sky-600 prose-a:underline-offset-4 hover:prose-a:text-sky-500 prose-pre:overflow-x-auto prose-pre:rounded-[20px] prose-pre:border prose-pre:border-border/70 prose-pre:bg-slate-950 prose-pre:px-4 prose-pre:py-3 prose-pre:text-slate-50 dark:prose-pre:bg-slate-100 dark:prose-pre:text-slate-900 prose-blockquote:rounded-r-[18px] prose-blockquote:border-l-4 prose-blockquote:border-sky-500/70 prose-blockquote:bg-sky-500/8 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:not-italic prose-ul:marker:text-sky-500 prose-ol:marker:text-sky-500 font-medium"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
        />
    );
}
