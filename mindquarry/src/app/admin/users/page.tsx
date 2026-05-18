import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isGlobalAdmin } from "@/lib/admin";
import { getSiteSettings } from "@/lib/settings";

export default async function AdminUsersPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const isAdmin = await isGlobalAdmin(session.user.id);
    if (!isAdmin) {
        return (
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border rounded shadow">
                <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
            </div>
        );
    }

    const settings = await getSiteSettings();

    const admins = await db.selectFrom("global_admins")
        .innerJoin("user", "user.id", "global_admins.user_id")
        .select(["global_admins.user_id", "user.name", "user.displayUsername", "user.username"])
        .execute();

    const firstAdmin = await db.selectFrom("user").select(["id", "name", "displayUsername", "username"]).where("id", "=", settings?.first_admin_user_id!).executeTakeFirst();

    async function addAdmin(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !(await isGlobalAdmin(session.user.id))) return;

        const username = formData.get("username") as string;
        if (!username) return;

        const user = await db.selectFrom("user").select("id").where("username", "=", username).executeTakeFirst();
        if (user) {
            await db.insertInto("global_admins").values({
                user_id: user.id,
                granted_by_id: session.user.id
            }).execute().catch(()=>null); // Ignore unique constraint errors
            revalidatePath("/admin/users");
        }
    }

    async function removeAdmin(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user || !(await isGlobalAdmin(session.user.id))) return;

        const userId = formData.get("user_id") as string;
        const settings = await getSiteSettings();

        // Prevent removing the first admin
        if (userId === settings?.first_admin_user_id) return;

        await db.deleteFrom("global_admins").where("user_id", "=", userId).execute();
        revalidatePath("/admin/users");
    }

    return (
        <div className="max-w-5xl mx-auto mt-12 p-6 bg-card border-[3px] border-black rounded-none shadow-[8px_8px_0_0_#000] dark:border-white dark:shadow-[8px_8px_0_0_#fff]">
            <h1 className="text-3xl font-black uppercase mb-8 border-b-[3px] border-black dark:border-white pb-2">Global Admins</h1>

            <div className="mb-8 p-6 bg-muted/30 border-2 border-black dark:border-white">
                <h2 className="font-bold mb-4 uppercase">Add New Admin</h2>
                <form action={addAdmin} className="flex gap-4">
                    <input name="username" required placeholder="Exact Username..." className="flex-1 p-2 border-2 border-black dark:border-white bg-card outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" className="px-6 py-2 bg-blue-500 text-white font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all cursor-pointer">
                        Add Admin
                    </button>
                </form>
            </div>

            <div className="space-y-4">
                {firstAdmin && (
                    <div className="flex justify-between items-center p-4 border-2 border-black dark:border-white bg-blue-50 dark:bg-blue-950">
                        <div>
                            <span className="font-bold text-lg">{firstAdmin.displayUsername || firstAdmin.username || firstAdmin.name}</span>
                            <span className="ml-2 text-xs uppercase bg-black text-white px-2 py-1 font-bold">Founder / First Admin</span>
                        </div>
                        <div className="text-muted-foreground text-sm font-bold uppercase italic">Cannot be removed</div>
                    </div>
                )}

                {admins.map(a => (
                    <div key={a.user_id} className="flex justify-between items-center p-4 border-2 border-black dark:border-white">
                        <div>
                            <span className="font-bold text-lg">{a.displayUsername || a.username || a.name}</span>
                            <span className="ml-2 text-xs uppercase border-2 border-black dark:border-white px-2 py-1 font-bold">Admin</span>
                        </div>
                        <form action={removeAdmin}>
                            <input type="hidden" name="user_id" value={a.user_id} />
                            <button type="submit" className="px-4 py-2 text-red-500 font-bold border-2 border-red-500 hover:bg-red-500 hover:text-white cursor-pointer shadow-[2px_2px_0_0_#ef4444]">
                                Remove
                            </button>
                        </form>
                    </div>
                ))}
            </div>
        </div>
    );
}
