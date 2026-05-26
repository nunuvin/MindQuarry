import { randomInt } from "crypto";

const KEYBOARD_FRIENDLY_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function clampTemporaryPasswordLength(length: number) {
    if (!Number.isFinite(length)) {
        return 16;
    }

    return Math.max(8, Math.min(64, Math.floor(length)));
}

export function generateSecureTemporaryPassword(length = 16) {
    const safeLength = clampTemporaryPasswordLength(length);

    return Array.from(
        { length: safeLength },
        () => KEYBOARD_FRIENDLY_PASSWORD_CHARS[randomInt(0, KEYBOARD_FRIENDLY_PASSWORD_CHARS.length)],
    ).join("");
}