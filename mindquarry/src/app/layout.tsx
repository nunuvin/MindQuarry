import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import CookieNotice from "@/components/cookie-notice";
import ThemeProvider from "@/components/theme-provider";
import { MindQuarryConfig } from "@/lib/config";
import { getSiteSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

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
    const settings = await getSiteSettings();
    const isGlobalAdmin = session?.user?.id === settings?.first_admin_user_id;

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
                    />
                    <div className="flex flex-1">
                        <Sidebar isGlobalAdmin={isGlobalAdmin} />
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
