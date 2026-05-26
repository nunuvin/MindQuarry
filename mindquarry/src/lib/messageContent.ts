export const DELETED_MESSAGE_TOMBSTONE = "<p><em>message deleted</em></p>";

export function isDeletedMessageBody(body: string | null | undefined) {
    return (body || "").trim() === DELETED_MESSAGE_TOMBSTONE;
}