import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import ThemeProvider from "@/components/theme-provider";
import { getSiteSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

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
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} min-h-screen flex flex-col`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <Navbar />
                    <div className="flex flex-1">
                        <Sidebar isGlobalAdmin={isGlobalAdmin} />
                        <main className="flex-1 w-full relative">
                            {children}
                        </main>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
