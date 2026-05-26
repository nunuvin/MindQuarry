export type MessagingUsernameValidationResult = {
    ok: boolean;
    username?: string;
    label?: string;
    userId?: string;
    message?: string;
};

export function normalizeMessagingUsernameCandidate(rawUsername: string) {
    return rawUsername.trim().replace(/^@+/, "").replace(/[\s,]+$/g, "");
}