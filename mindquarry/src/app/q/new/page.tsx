import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { generateUUID } from "@/lib/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function NewQuarryPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");

    const settings = await getSiteSettings();
    if (settings?.simplified_mode_enabled) {
        redirect("/q");
    }

    async function createQuarry(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const name = formData.get("name") as string;
        const description = formData.get("description") as string;

        if (!name || name.includes(" ")) {
            return; // In real app, return form error
        }

        let newQuarryName: string | null = null;
        try {
            const quarry = await db.insertInto("quarries").values({
                id: generateUUID(),
                name: name.toLowerCase(),
                description,
            }).returning(["id", "name"]).executeTakeFirst();

            if (quarry) {
                // Assign creator as admin
                await db.insertInto("quarry_members").values({
                    quarry_id: quarry.id,
                    user_id: session.user.id,
                    role: 'admin'
                }).execute();

                newQuarryName = quarry.name;
            }
        } catch (e) {
            console.error("Failed to create quarry", e);
        }

        if (newQuarryName) {
            redirect(`/q/${newQuarryName}`);
        }
    }

    return (
        <div className="max-w-xl mx-auto mt-12 p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
            <h1 className="text-2xl font-black mb-6 uppercase border-b-2 border-black dark:border-white pb-2">Create a New Quarry</h1>
            <form action={createQuarry} className="space-y-6">
                <div>
                    <label className="block font-bold mb-2">Quarry Name</label>
                    <input name="name" required pattern="[a-zA-Z0-9_-]+" title="No spaces allowed" className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. javascript" />
                    <p className="text-xs text-muted-foreground mt-1">No spaces. Will be accessed via /q/name</p>
                </div>
                <div>
                    <label className="block font-bold mb-2">Description</label>
                    <textarea name="description" rows={4} className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500" placeholder="What is this community about?"></textarea>
                </div>
                <button type="submit" className="cursor-pointer w-full py-3 font-bold border-[3px] border-black dark:border-white bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                    Create Quarry
                </button>
            </form>
        </div>
    );
}
