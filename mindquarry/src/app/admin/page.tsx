import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";
import { isGlobalAdmin } from "@/lib/admin";

export default async function AdminDashboardPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const settings = await getSiteSettings();

    // Set first admin if empty
    if (settings && !settings.first_admin_user_id) {
        const firstUser = await db.selectFrom("user").select("id").orderBy("createdAt", "asc").executeTakeFirst();
        if (firstUser) {
             await db.updateTable("site_settings").set({ first_admin_user_id: firstUser.id }).where("id", "=", 1).execute();
             settings.first_admin_user_id = firstUser.id;
        }
    }

    const isAdmin = await isGlobalAdmin(session.user.id);

    if (!isAdmin) {
        return (
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border rounded shadow">
                <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
                <p>You must be a Global Administrator to view this page.</p>
            </div>
        );
    }

    async function toggleSimplifiedMode() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const isAdminUser = await isGlobalAdmin(session.user.id);
        if (!isAdminUser) return;

        const current = await db.selectFrom("site_settings").select("simplified_mode_enabled").where("id", "=", 1).executeTakeFirst();
        await db.updateTable("site_settings").set({ simplified_mode_enabled: !current?.simplified_mode_enabled }).where("id", "=", 1).execute();
        revalidatePath("/admin");
    }

    async function toggleRegistration() {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;
        const isAdminUser = await isGlobalAdmin(session.user.id);
        if (!isAdminUser) return;

        const current = await db.selectFrom("site_settings").select("registration_enabled").where("id", "=", 1).executeTakeFirst();
        await db.updateTable("site_settings").set({ registration_enabled: !current?.registration_enabled }).where("id", "=", 1).execute();
        revalidatePath("/admin");
    }

    return (
        <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border-[3px] border-black rounded-none shadow-[8px_8px_0_0_#000] dark:border-white dark:shadow-[8px_8px_0_0_#fff]">
            <h1 className="text-3xl font-black uppercase mb-8 border-b-[3px] border-black dark:border-white pb-2">Global Admin Panel</h1>

            <div className="space-y-8">
                <section>
                    <h2 className="text-xl font-bold mb-4">Site Settings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border-[2px] border-black dark:border-white hover:bg-muted transition-colors flex items-center justify-between">
                            <div>
                                <h3 className="font-bold">Simplified Mode</h3>
                                <p className="text-sm text-muted-foreground">Disables DMs and custom Quarries</p>
                            </div>
                            <form action={toggleSimplifiedMode}>
                                <button className={`cursor-pointer px-4 py-2 font-bold border-2 border-black dark:border-white ${settings?.simplified_mode_enabled ? 'bg-blue-500 text-white' : 'bg-transparent hover:bg-muted-foreground/10'}`}>
                                    {settings?.simplified_mode_enabled ? "ON" : "OFF"}
                                </button>
                            </form>
                        </div>
                        <div className="p-4 border-[2px] border-black dark:border-white hover:bg-muted transition-colors flex items-center justify-between">
                            <div>
                                <h3 className="font-bold">Registration</h3>
                                <p className="text-sm text-muted-foreground">Allow new signups</p>
                            </div>
                            <form action={toggleRegistration}>
                                <button className={`cursor-pointer px-4 py-2 font-bold border-2 border-black dark:border-white ${settings?.registration_enabled ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                    {settings?.registration_enabled ? "ENABLED" : "DISABLED"}
                                </button>
                            </form>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
