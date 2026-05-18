import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function QuarrySettingsPage({ params }: { params: Promise<{ name: string }> }) {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });

    if (!session?.user) {
        redirect("/login");
    }

    const resolvedParams = await params;

    const quarry = await db.selectFrom("quarries").selectAll().where("name", "=", resolvedParams.name).executeTakeFirst();
    if (!quarry) return notFound();

    // Verify user is an admin of this quarry
    const membership = await db.selectFrom("quarry_members")
        .selectAll()
        .where("quarry_id", "=", quarry.id)
        .where("user_id", "=", session.user.id)
        .executeTakeFirst();

    if (!membership || membership.role !== 'admin') {
        return (
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-card border rounded shadow">
                <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
                <p>You must be a Quarry Admin to view this page.</p>
                <Link href={`/q/${quarry.name}`} className="mt-4 block text-blue-500 hover:underline">Return to q/{quarry.name}</Link>
            </div>
        );
    }

    async function updateQuarry(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const membership = await db.selectFrom("quarry_members").selectAll().where("quarry_id", "=", quarry!.id).where("user_id", "=", session.user.id).executeTakeFirst();
        if (!membership || membership.role !== 'admin') return;

        const description = formData.get("description") as string;
        const is_invite_only = formData.get("is_invite_only") === "on";

        await db.updateTable("quarries").set({ description, is_invite_only }).where("id", "=", quarry!.id).execute();
        revalidatePath(`/q/${quarry!.name}`);
        revalidatePath(`/q/${quarry!.name}/settings`);
    }

    return (
        <div className="max-w-4xl mx-auto mt-8 p-4">
            <Link href={`/q/${quarry.name}`} className="text-sm font-bold text-muted-foreground hover:underline mb-4 inline-block">&larr; Back to q/{quarry.name}</Link>

            <div className="p-8 bg-card border-[3px] border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff]">
                <h1 className="text-3xl font-black uppercase mb-8 border-b-[3px] border-black dark:border-white pb-2">q/{quarry.name} Settings</h1>

                <form action={updateQuarry} className="space-y-6">
                    <div>
                        <label className="block font-bold mb-2">Description</label>
                        <textarea name="description" rows={4} defaultValue={quarry.description || ""} className="w-full p-3 border-2 border-black dark:border-white bg-transparent outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="is_invite_only" name="is_invite_only" defaultChecked={quarry.is_invite_only || false} className="w-5 h-5 border-2 border-black dark:border-white accent-black dark:accent-white" />
                        <label htmlFor="is_invite_only" className="font-bold cursor-pointer">Invite-Only Mode (Private)</label>
                    </div>

                    <button type="submit" className="w-full py-3 font-bold border-[3px] border-black dark:border-white bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] cursor-pointer">
                        Save Settings
                    </button>
                </form>
            </div>
        </div>
    );
}
