export const MindQuarryConfig = {
    MESSAGING: {
        MAX_NEW_CHATS_PER_MIN: 3,
        MAX_MESSAGES_PER_MIN: 20,
    },
    FORUM: {
        MAX_QUERIES_PER_MIN: 5,
        MAX_REPLIES_PER_MIN: 10,
        FEED_QUERY_LIMIT: 20,
        FEED_FOLLOWING_LIMIT: 5,
        MIN_SCORE_VISIBILITY: -5,
    },
    RATE_LIMIT_WINDOW_MS: 60000,
};
