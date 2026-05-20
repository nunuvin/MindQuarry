import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function UserSettingsPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    let profile = await db.selectFrom("profiles").selectAll().where("user_id", "=", session.user.id).executeTakeFirst();
    if (!profile) {
        await db.insertInto("profiles").values({ user_id: session.user.id }).execute();
        profile = await db.selectFrom("profiles").selectAll().where("user_id", "=", session.user.id).executeTakeFirst();
    }

    async function saveSettings(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const bio = formData.get("bio") as string;
        const messaging_privacy = formData.get("messaging_privacy") as string;

        await db.updateTable("profiles")
            .set({
                bio: bio || null,
                messaging_privacy: messaging_privacy || 'anyone',
                updated_at: new Date()
            })
            .where("user_id", "=", session.user.id)
            .execute();

        revalidatePath("/settings");
        revalidatePath(`/users/${session.user.username}`);
    }

    return (
        <div className="max-w-3xl mx-auto mt-12 p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
            <h1 className="text-3xl font-black uppercase mb-8 border-b-[3px] border-black dark:border-white pb-2">Profile Settings</h1>

            <form action={saveSettings} className="space-y-6">
                <div>
                    <label className="block font-bold mb-2 uppercase text-sm">Bio</label>
                    <textarea
                        name="bio"
                        rows={5}
                        defaultValue={profile?.bio || ""}
                        className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        placeholder="Tell the community about yourself..."
                    ></textarea>
                </div>

                <div>
                    <label className="block font-bold mb-2 uppercase text-sm">Messaging Privacy</label>
                    <select
                        name="messaging_privacy"
                        defaultValue={profile?.messaging_privacy || "anyone"}
                        className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    >
                        <option value="anyone">Allow messages from anyone</option>
                        <option value="quarry_members">Only users from joined Quarries</option>
                        <option value="mutuals">Only Mutual Follows</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-2 font-bold">Mutual follows will always override these blocks.</p>
                </div>

                <button type="submit" className="px-8 py-3 bg-black text-white dark:bg-white dark:text-black font-black uppercase border-2 border-black dark:border-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none transition-all w-full">
                    Save Changes
                </button>
            </form>
        </div>
    );
}
