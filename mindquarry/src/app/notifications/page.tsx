import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getNotificationPageItems, markAllNotificationsRead } from "@/lib/notifications";

export default async function NotificationsPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    await markAllNotificationsRead(session.user.id);
    const notifications = await getNotificationPageItems(session.user.id);

    return (
        <div className="page-shell max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
                <div>
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">Notifications</p>
                    <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Recent Activity</h1>
                </div>
                <div className="flex gap-3">
                    <Link href="/settings" className="soft-button">Settings</Link>
                    <Link href="/settings/follows" className="soft-button">Things You Follow</Link>
                </div>
            </div>

            <div className="soft-panel p-6 sm:p-8">
                <div className="space-y-4">
                    {notifications.length === 0 && <p className="text-sm text-muted-foreground">You have no notifications yet.</p>}
                    {notifications.map((notification) => {
                        const actor = notification.displayUsername || notification.username || notification.name || "Someone";
                        const content = notification.body || notification.title;
                        const createdAt = notification.created_at ? new Date(notification.created_at).toLocaleString() : "Just now";

                        return (
                            <Link
                                key={notification.id}
                                href={notification.href || "/notifications"}
                                className="block rounded-[20px] border border-border/70 bg-card p-4 transition hover:border-sky-400/60 hover:bg-muted/35"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-sky-600">{actor}</div>
                                        <div className="mt-1 text-base font-semibold tracking-tight">{notification.title}</div>
                                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{content}</p>
                                    </div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        {createdAt}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
