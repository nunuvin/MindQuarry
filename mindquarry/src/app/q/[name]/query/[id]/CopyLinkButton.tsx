"use client";
import React from "react";

export function CopyLinkButton({ answerId }: { answerId: string }) {
    return (
        <button onClick={() => {
            const url = new URL(window.location.href);
            url.hash = `reply-${answerId}`;
            navigator.clipboard.writeText(url.toString());
            alert("Link copied!");
        }} className="cursor-pointer px-2 border-2 border-black dark:border-white bg-muted hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors" title="Copy Link">
            🔗
        </button>
    );
}
