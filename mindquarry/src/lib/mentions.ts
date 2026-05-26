import { db } from "./db";
import { richTextToPlainText } from "./utils";

const mentionPattern = /(^|[\s(])@([a-zA-Z0-9_]+)/g;

function stripMentionAnchors(content: string) {
    return content.replace(/<a\b[^>]*data-mention=(['"])true\1[^>]*>@([a-zA-Z0-9_]+)<\/a>/gi, "@$2");
}

function stripQuotedContent(content: string) {
    return content.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, " ");
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMentionedUsernames(content: string) {
    const plainText = richTextToPlainText(stripQuotedContent(stripMentionAnchors(content)));
    const usernames: string[] = [];
    const seen = new Set<string>();

    for (const match of plainText.matchAll(mentionPattern)) {
        const username = match[2]?.trim().toLowerCase();

        if (username && !seen.has(username)) {
            seen.add(username);
            usernames.push(username);
        }
    }

    return usernames;
}

export async function resolveFirstMentionedUser(content: string, excludeUserId?: string | null) {
    const usernames = extractMentionedUsernames(content);

    if (usernames.length === 0) {
        return null;
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

    for (const username of usernames) {
        const user = usersByUsername.get(username);

        if (user?.id && user.username) {
            return {
                id: user.id,
                username: user.username,
            };
        }
    }

    return null;
}

export function applyMentionMarkup(content: string, username?: string | null) {
    const normalizedContent = stripMentionAnchors(content);

    if (!username) {
        return normalizedContent;
    }

    const escapedUsername = escapeRegex(username);
    const mentionLink = `<a href="/users/${encodeURIComponent(username)}" data-mention="true" class="mq-mention">@${username}</a>`;

    return normalizedContent.replace(
        new RegExp(`(^|[^\\w])@(${escapedUsername})(?![\\w])`, "i"),
        (_match, prefix) => `${prefix}${mentionLink}`,
    );
}

export async function normalizeMentionContent(content: string, excludeUserId?: string | null) {
    const mention = await resolveFirstMentionedUser(content, excludeUserId);

    return {
        content: applyMentionMarkup(content, mention?.username),
        mention,
    };
}