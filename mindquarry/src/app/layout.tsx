import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import CookieNotice from "@/components/cookie-notice";
import ThemeProvider from "@/components/theme-provider";
import { MindQuarryConfig } from "@/lib/config";
import { listQuarryNavigationOptions } from "@/lib/quarries";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isGlobalAdmin as getIsGlobalAdmin } from "@/lib/admin";

const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body" });
const displayFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
    title: "MindQuarry",
    description: "Stack Overflow meets Reddit",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    const isGlobalAdmin = session?.user?.id ? await getIsGlobalAdmin(session.user.id) : false;
    const quarryRoles = session?.user?.id
        ? await listQuarryNavigationOptions({ userId: session.user.id })
        : [];
    const adminQuarries = session?.user?.id
        ? await listQuarryNavigationOptions({ userId: session.user.id, viewerIsGlobalAdmin: isGlobalAdmin })
        : [];

    return (
        <html lang="en" suppressHydrationWarning className={`${bodyFont.variable} ${displayFont.variable}`}>
            <body className="min-h-screen flex flex-col font-sans antialiased">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <Navbar
                        notificationBadgeCap={MindQuarryConfig.NOTIFICATIONS.BADGE_CAP}
                        notificationPollIntervalMs={MindQuarryConfig.NOTIFICATIONS.POLL_INTERVAL_MS}
                        quarryRoles={quarryRoles}
                    />
                    <div className="flex flex-1">
                        <Sidebar isGlobalAdmin={isGlobalAdmin} adminQuarries={adminQuarries} />
                        <main className="relative flex-1 w-full overflow-x-hidden">
                            {children}
                        </main>
                    </div>
                    <CookieNotice
                        enabled={MindQuarryConfig.LEGAL.COOKIE_NOTICE_ENABLED}
                        message={MindQuarryConfig.LEGAL.COOKIE_NOTICE_TEXT}
                    />
                </ThemeProvider>
            </body>
        </html>
    );
}
