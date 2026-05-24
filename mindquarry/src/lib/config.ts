import fs from "node:fs";
import path from "node:path";

import toml from "toml";

const CONFIG_FILE_NAME = "mq_config.toml";

const DEFAULT_MINDQUARRY_CONFIG = {
    MESSAGING: {
        MAX_NEW_CHATS_PER_MIN: 3,
        MAX_MESSAGES_PER_MIN: 20,
        MAX_MESSAGE_DELETES_PER_MIN: 20,
    },
    QUARRIES: {
        MAX_NEW_QUARRIES_PER_MIN: 2,
        MAX_SETTINGS_UPDATES_PER_MIN: 10,
    },
    SEARCH: {
        INITIAL_USERS_LIMIT: 5,
        INITIAL_QUARRIES_LIMIT: 5,
        INITIAL_QUERIES_LIMIT: 100,
        FETCH_USERS_LIMIT: 5,
        FETCH_QUARRIES_LIMIT: 5,
        FETCH_QUERIES_LIMIT: 100,
        MAX_INITIAL_REQUESTS_PER_MIN: 30,
        MAX_FOLLOW_UP_REQUESTS_PER_MIN: 120,
    },
    FORUM: {
        MAX_QUERIES_PER_MIN: 5,
        MAX_REPLIES_PER_MIN: 10,
        MAX_QUERY_EDITS_PER_MIN: 10,
        MAX_ANSWER_EDITS_PER_MIN: 15,
        MAX_ANSWER_DELETES_PER_MIN: 15,
        FEED_QUERY_LIMIT: 20,
        FEED_FOLLOWING_LIMIT: 5,
        MIN_SCORE_VISIBILITY: -5,
        UNIQUE_VIEW_WINDOW_MS: 300000,
    },
    NOTIFICATIONS: {
        POLL_INTERVAL_MS: 60000,
        BADGE_CAP: 10,
    },
    LEGAL: {
        COOKIE_NOTICE_ENABLED: true,
        COOKIE_NOTICE_TEXT: "MindQuarry uses essential cookies for sign-in, session security, and saved interface preferences.",
    },
    RATE_LIMIT_WINDOW_MS: 60000,
} as const;

function readNumber(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function loadMindQuarryConfig() {
    const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);

    try {
        const parsed = toml.parse(fs.readFileSync(configPath, "utf8")) as {
            rate_limits?: {
                window_ms?: number;
                messaging?: {
                    max_new_chats_per_min?: number;
                    max_messages_per_min?: number;
                    max_message_deletes_per_min?: number;
                };
                quarries?: {
                    max_new_quarries_per_min?: number;
                    max_settings_updates_per_min?: number;
                };
            };
            search?: {
                initial_users_limit?: number;
                initial_quarries_limit?: number;
                initial_queries_limit?: number;
                fetch_users_limit?: number;
                fetch_quarries_limit?: number;
                fetch_queries_limit?: number;
                max_initial_requests_per_min?: number;
                max_follow_up_requests_per_min?: number;
            };
            forum?: {
                max_queries_per_min?: number;
                max_replies_per_min?: number;
                max_query_edits_per_min?: number;
                max_answer_edits_per_min?: number;
                max_answer_deletes_per_min?: number;
                feed_query_limit?: number;
                feed_following_limit?: number;
                min_score_visibility?: number;
                unique_view_window_ms?: number;
            };
            notifications?: {
                poll_interval_ms?: number;
                badge_cap?: number;
            };
            legal?: {
                cookie_notice_enabled?: boolean;
                cookie_notice_text?: string;
            };
        };

        return {
            MESSAGING: {
                MAX_NEW_CHATS_PER_MIN: readNumber(parsed.rate_limits?.messaging?.max_new_chats_per_min, DEFAULT_MINDQUARRY_CONFIG.MESSAGING.MAX_NEW_CHATS_PER_MIN),
                MAX_MESSAGES_PER_MIN: readNumber(parsed.rate_limits?.messaging?.max_messages_per_min, DEFAULT_MINDQUARRY_CONFIG.MESSAGING.MAX_MESSAGES_PER_MIN),
                MAX_MESSAGE_DELETES_PER_MIN: readNumber(parsed.rate_limits?.messaging?.max_message_deletes_per_min, DEFAULT_MINDQUARRY_CONFIG.MESSAGING.MAX_MESSAGE_DELETES_PER_MIN),
            },
            QUARRIES: {
                MAX_NEW_QUARRIES_PER_MIN: readNumber(parsed.rate_limits?.quarries?.max_new_quarries_per_min, DEFAULT_MINDQUARRY_CONFIG.QUARRIES.MAX_NEW_QUARRIES_PER_MIN),
                MAX_SETTINGS_UPDATES_PER_MIN: readNumber(parsed.rate_limits?.quarries?.max_settings_updates_per_min, DEFAULT_MINDQUARRY_CONFIG.QUARRIES.MAX_SETTINGS_UPDATES_PER_MIN),
            },
            SEARCH: {
                INITIAL_USERS_LIMIT: readNumber(parsed.search?.initial_users_limit, DEFAULT_MINDQUARRY_CONFIG.SEARCH.INITIAL_USERS_LIMIT),
                INITIAL_QUARRIES_LIMIT: readNumber(parsed.search?.initial_quarries_limit, DEFAULT_MINDQUARRY_CONFIG.SEARCH.INITIAL_QUARRIES_LIMIT),
                INITIAL_QUERIES_LIMIT: readNumber(parsed.search?.initial_queries_limit, DEFAULT_MINDQUARRY_CONFIG.SEARCH.INITIAL_QUERIES_LIMIT),
                FETCH_USERS_LIMIT: readNumber(parsed.search?.fetch_users_limit, DEFAULT_MINDQUARRY_CONFIG.SEARCH.FETCH_USERS_LIMIT),
                FETCH_QUARRIES_LIMIT: readNumber(parsed.search?.fetch_quarries_limit, DEFAULT_MINDQUARRY_CONFIG.SEARCH.FETCH_QUARRIES_LIMIT),
                FETCH_QUERIES_LIMIT: readNumber(parsed.search?.fetch_queries_limit, DEFAULT_MINDQUARRY_CONFIG.SEARCH.FETCH_QUERIES_LIMIT),
                MAX_INITIAL_REQUESTS_PER_MIN: readNumber(parsed.search?.max_initial_requests_per_min, DEFAULT_MINDQUARRY_CONFIG.SEARCH.MAX_INITIAL_REQUESTS_PER_MIN),
                MAX_FOLLOW_UP_REQUESTS_PER_MIN: readNumber(parsed.search?.max_follow_up_requests_per_min, DEFAULT_MINDQUARRY_CONFIG.SEARCH.MAX_FOLLOW_UP_REQUESTS_PER_MIN),
            },
            FORUM: {
                MAX_QUERIES_PER_MIN: readNumber(parsed.forum?.max_queries_per_min, DEFAULT_MINDQUARRY_CONFIG.FORUM.MAX_QUERIES_PER_MIN),
                MAX_REPLIES_PER_MIN: readNumber(parsed.forum?.max_replies_per_min, DEFAULT_MINDQUARRY_CONFIG.FORUM.MAX_REPLIES_PER_MIN),
                MAX_QUERY_EDITS_PER_MIN: readNumber(parsed.forum?.max_query_edits_per_min, DEFAULT_MINDQUARRY_CONFIG.FORUM.MAX_QUERY_EDITS_PER_MIN),
                MAX_ANSWER_EDITS_PER_MIN: readNumber(parsed.forum?.max_answer_edits_per_min, DEFAULT_MINDQUARRY_CONFIG.FORUM.MAX_ANSWER_EDITS_PER_MIN),
                MAX_ANSWER_DELETES_PER_MIN: readNumber(parsed.forum?.max_answer_deletes_per_min, DEFAULT_MINDQUARRY_CONFIG.FORUM.MAX_ANSWER_DELETES_PER_MIN),
                FEED_QUERY_LIMIT: readNumber(parsed.forum?.feed_query_limit, DEFAULT_MINDQUARRY_CONFIG.FORUM.FEED_QUERY_LIMIT),
                FEED_FOLLOWING_LIMIT: readNumber(parsed.forum?.feed_following_limit, DEFAULT_MINDQUARRY_CONFIG.FORUM.FEED_FOLLOWING_LIMIT),
                MIN_SCORE_VISIBILITY: readNumber(parsed.forum?.min_score_visibility, DEFAULT_MINDQUARRY_CONFIG.FORUM.MIN_SCORE_VISIBILITY),
                UNIQUE_VIEW_WINDOW_MS: readNumber(parsed.forum?.unique_view_window_ms, DEFAULT_MINDQUARRY_CONFIG.FORUM.UNIQUE_VIEW_WINDOW_MS),
            },
            NOTIFICATIONS: {
                POLL_INTERVAL_MS: readNumber(parsed.notifications?.poll_interval_ms, DEFAULT_MINDQUARRY_CONFIG.NOTIFICATIONS.POLL_INTERVAL_MS),
                BADGE_CAP: readNumber(parsed.notifications?.badge_cap, DEFAULT_MINDQUARRY_CONFIG.NOTIFICATIONS.BADGE_CAP),
            },
            LEGAL: {
                COOKIE_NOTICE_ENABLED: readBoolean(parsed.legal?.cookie_notice_enabled, DEFAULT_MINDQUARRY_CONFIG.LEGAL.COOKIE_NOTICE_ENABLED),
                COOKIE_NOTICE_TEXT: readString(parsed.legal?.cookie_notice_text, DEFAULT_MINDQUARRY_CONFIG.LEGAL.COOKIE_NOTICE_TEXT),
            },
            RATE_LIMIT_WINDOW_MS: readNumber(parsed.rate_limits?.window_ms, DEFAULT_MINDQUARRY_CONFIG.RATE_LIMIT_WINDOW_MS),
        };
    } catch {
        return DEFAULT_MINDQUARRY_CONFIG;
    }
}

export const MindQuarryConfig = loadMindQuarryConfig();
