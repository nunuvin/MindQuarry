import { db } from "./db";
import { richTextToPlainText } from "./utils";

const mentionPattern = /(^|[\s(])@([a-zA-Z0-9_]+)/g;

export type MentionedUser = {
    id: string;
    username: string;
};

function stripMentionAnchors(content: string) {
    return content.replace(/<a\b[^>]*data-mention=(['"])true\1[^>]*>@([a-zA-Z0-9_]+)<\/a>/gi, "@$2");
}

function stripQuotedContent(content: string) {
    return content.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, " ");
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMentionDirectives(content: string) {
    const plainText = richTextToPlainText(stripQuotedContent(stripMentionAnchors(content)));
    const usernames: string[] = [];
    const seen = new Set<string>();
    let mentionsAll = false;

    for (const match of plainText.matchAll(mentionPattern)) {
        const token = match[2]?.trim().toLowerCase();

        if (!token) {
            continue;
        }

        if (token === "all") {
            mentionsAll = true;
            continue;
        }

        if (!seen.has(token)) {
            seen.add(token);
            usernames.push(token);
        }
    }

    return {
        usernames,
        mentionsAll,
    };
}

export function extractMentionedUsernames(content: string) {
    return extractMentionDirectives(content).usernames;
}

export function hasAllMention(content: string) {
    return extractMentionDirectives(content).mentionsAll;
}

export async function resolveMentionedUsers(content: string, excludeUserId?: string | null): Promise<MentionedUser[]> {
    const usernames = extractMentionedUsernames(content);

    if (usernames.length === 0) {
        return [];
    }

    let query = db.selectFrom("user")
        .select(["user.id", "user.username"])
        .where("user.username", "in", usernames);

    if (excludeUserId) {
        query = query.where("user.id", "!=", excludeUserId);
    }

    const users = await query.execute();
    const usersByUsername = new Map(
        users
            .filter((user) => user.username)
            .map((user) => [user.username!.toLowerCase(), user]),
    );

    return usernames.flatMap((username) => {
        const user = usersByUsername.get(username);

        if (!user?.id || !user.username) {
            return [];
        }

        return [{
            id: user.id,
            username: user.username,
        }];
    });
}

export async function resolveFirstMentionedUser(content: string, excludeUserId?: string | null) {
    const mentions = await resolveMentionedUsers(content, excludeUserId);
    return mentions[0] ?? null;
}

export function applyMentionMarkup(content: string, usernames: string[] = []) {
    const normalizedContent = stripMentionAnchors(content);

    if (usernames.length === 0) {
        return normalizedContent;
    }

    return usernames.reduce((nextContent, username) => {
        const escapedUsername = escapeRegex(username);
        const mentionLink = `<a href="/users/${encodeURIComponent(username)}" data-mention="true" class="mq-mention">@${username}</a>`;

        return nextContent.replace(
            new RegExp(`(^|[^\\w])@(${escapedUsername})(?![\\w])`, "gi"),
            (_match, prefix) => `${prefix}${mentionLink}`,
        );
    }, normalizedContent);
}

export async function normalizeMentionContent(content: string, excludeUserId?: string | null) {
    const mentions = await resolveMentionedUsers(content, excludeUserId);
    const mention = mentions[0] ?? null;

    return {
        content: applyMentionMarkup(content, mentions.map((entry) => entry.username)),
        mention,
        mentions,
        mentionsAll: hasAllMention(content),
    };
}