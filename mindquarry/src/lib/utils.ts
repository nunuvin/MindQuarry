import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function richTextToPlainText(content: string) {
    return content
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#39;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, " ")
        .trim();
}

export function hasRichTextContent(content: string) {
    return richTextToPlainText(content).length > 0;
}

export function getRichTextPreview(content: string, maxLength = 180) {
    const text = richTextToPlainText(content);

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength).trimEnd()}...`;
}

export function generateUUID() {
    const typedCrypto = globalThis.crypto;

    if (typedCrypto?.randomUUID) {
        return typedCrypto.randomUUID();
    }

    if (typedCrypto?.getRandomValues) {
        const bytes = typedCrypto.getRandomValues(new Uint8Array(16));

        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const segments = [
            Array.from(bytes.slice(0, 4), (byte) => byte.toString(16).padStart(2, "0")).join(""),
            Array.from(bytes.slice(4, 6), (byte) => byte.toString(16).padStart(2, "0")).join(""),
            Array.from(bytes.slice(6, 8), (byte) => byte.toString(16).padStart(2, "0")).join(""),
            Array.from(bytes.slice(8, 10), (byte) => byte.toString(16).padStart(2, "0")).join(""),
            Array.from(bytes.slice(10, 16), (byte) => byte.toString(16).padStart(2, "0")).join(""),
        ];

        return segments.join("-");
    }

    throw new Error("Secure UUID generation is not available in this environment.");
}
