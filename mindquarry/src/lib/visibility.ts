import { db } from "./db";

type QuarryVisibility = "public" | "authenticated" | "members";
type ProfileVisibility = "public" | "authenticated" | "private";

export function getQuarryVisibility(quarry: { visibility?: string | null; is_invite_only?: boolean | null }) {
    if (quarry.visibility === "authenticated" || quarry.visibility === "members") {
        return quarry.visibility;
    }

    if (quarry.is_invite_only) {
        return "members" satisfies QuarryVisibility;
    }

    return "public" satisfies QuarryVisibility;
}

export async function canViewQuarry(
    quarry: { id: string; visibility?: string | null; is_invite_only?: boolean | null },
    viewerId?: string,
    viewerIsGlobalAdmin = false,
) {
    const visibility = getQuarryVisibility(quarry);

    if (viewerIsGlobalAdmin) {
        return { allowed: true, visibility, isMember: false };
    }

    if (visibility === "public") {
        return { allowed: true, visibility, isMember: false };
    }

    if (visibility === "authenticated") {
        return { allowed: Boolean(viewerId), visibility, isMember: false };
    }

    if (!viewerId) {
        return { allowed: false, visibility, isMember: false };
    }

    const membership = await db.selectFrom("quarry_members")
        .select("user_id")
        .where("quarry_id", "=", quarry.id)
        .where("user_id", "=", viewerId)
        .executeTakeFirst();

    return { allowed: Boolean(membership), visibility, isMember: Boolean(membership) };
}

export function getProfileVisibility(profile: { profile_visibility?: string | null } | null | undefined) {
    if (profile?.profile_visibility === "authenticated" || profile?.profile_visibility === "private") {
        return profile.profile_visibility;
    }

    return "public" satisfies ProfileVisibility;
}

export function canViewProfile(
    profileOwnerId: string,
    profileVisibility: string | null | undefined,
    viewerId?: string,
    viewerIsGlobalAdmin = false,
) {
    if (viewerId && viewerId === profileOwnerId) {
        return true;
    }

    if (viewerIsGlobalAdmin) {
        return true;
    }

    if (profileVisibility === "authenticated") {
        return Boolean(viewerId);
    }

    if (profileVisibility === "private") {
        return false;
    }

    return true;
}