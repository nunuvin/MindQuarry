type RoleBadgesProps = {
    isInstanceAdmin?: boolean;
    quarryRole?: string | null;
    variant?: "compact" | "expanded";
};

type RoleBadgeDefinition = {
    key: string;
    shortLabel: string;
    longLabel: string;
    className: string;
};

export function getRoleBadgeDefinitions({
    isInstanceAdmin = false,
    quarryRole,
}: {
    isInstanceAdmin?: boolean;
    quarryRole?: string | null;
}) {
    const badges: RoleBadgeDefinition[] = [];

    if (isInstanceAdmin) {
        badges.push({
            key: "instance-admin",
            shortLabel: "admin",
            longLabel: "Instance Admin",
            className: "border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400",
        });
    }

    if (quarryRole === "admin") {
        badges.push({
            key: "quarry-admin",
            shortLabel: "qadmin",
            longLabel: "Quarry Admin",
            className: "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        });
    }

    if (quarryRole === "moderator") {
        badges.push({
            key: "quarry-moderator",
            shortLabel: "qmod",
            longLabel: "Quarry Moderator",
            className: "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        });
    }

    return badges;
}

export function RoleBadges({ isInstanceAdmin = false, quarryRole, variant = "compact" }: RoleBadgesProps) {
    const badges = getRoleBadgeDefinitions({ isInstanceAdmin, quarryRole });

    if (badges.length === 0) {
        return null;
    }

    return (
        <span className="inline-flex flex-wrap items-center gap-2 align-middle">
            {badges.map((badge) => (
                <span
                    key={badge.key}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${badge.className}`}
                    title={variant === "compact" ? badge.longLabel : undefined}
                >
                    {variant === "expanded" ? badge.longLabel : badge.shortLabel}
                </span>
            ))}
        </span>
    );
}